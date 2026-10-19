import { document, extraction } from "@horkos/db/schema/submission";
import { and, eq } from "drizzle-orm";

import { ENV } from "@/env.server";
import type { ExtractionStatus } from "@/lib/extraction";
import { PublicError } from "@/lib/public-error";
import { detectDocumentType } from "@/lib/submission";
import type { StoredDocumentKind } from "@/lib/submission";
import { getDb } from "@/services";

// Stores an uploaded PDF, reads it and records both, replacing the document of the same kind:
// a new R2 object, the same rows, and the old object deleted.
export async function storeDocument<
  Result extends {
    status: ExtractionStatus;
    fields: Record<string, string>;
    warnings: string[];
  },
>({
  invitationId,
  kind,
  objectKey,
  file,
  bytes,
  read,
}: {
  invitationId: string;
  kind: StoredDocumentKind;
  objectKey: string;
  file: File;
  bytes: ArrayBuffer;
  read: (bytes: ArrayBuffer) => Promise<Result>;
}) {
  const contentType = detectDocumentType(new Uint8Array(bytes.slice(0, 8)));

  if (!contentType) {
    throw new PublicError("Sube un archivo PDF.");
  }

  await ENV.DOCUMENTS.put(objectKey, bytes, {
    httpMetadata: { contentType },
  });

  let replaced: string | undefined;

  try {
    const result = await read(bytes);
    const db = getDb();

    // Together, so a document is never listed with the extraction of the one it replaced,
    // and each upload learns exactly which object it displaced.
    const [previous] = await db.batch([
      db
        .select({ objectKey: document.objectKey })
        .from(document)
        .where(
          and(eq(document.invitationId, invitationId), eq(document.kind, kind))
        ),
      db
        .insert(document)
        .values({
          invitationId,
          kind,
          objectKey,
          fileName: file.name,
          contentType,
          size: file.size,
        })
        .onConflictDoUpdate({
          target: [document.invitationId, document.kind],
          set: {
            objectKey,
            fileName: file.name,
            contentType,
            size: file.size,
            uploadedAt: new Date(),
          },
        }),
      db
        .insert(extraction)
        .values({ invitationId, kind, ...result })
        .onConflictDoUpdate({
          target: [extraction.invitationId, extraction.kind],
          set: { ...result, extractedAt: new Date() },
        }),
    ]);

    replaced = previous[0]?.objectKey;

    return result;
  } catch (error) {
    await ENV.DOCUMENTS.delete(objectKey);
    throw error;
  } finally {
    if (replaced) {
      await ENV.DOCUMENTS.delete(replaced);
    }
  }
}
