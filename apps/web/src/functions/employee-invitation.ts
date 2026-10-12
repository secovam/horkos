import { invitation } from "@horkos/db/schema/invitation";
import { document, extraction, submission } from "@horkos/db/schema/submission";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { ENV } from "@/env.server";
import type { UploadedDocuments } from "@/lib/document-upload";
import { FAILED_EXTRACTION } from "@/lib/extraction";
import { hashInvitationToken } from "@/lib/invitation";
import {
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LIST,
  detectDocumentType,
  documentFileSchema,
  employeeObjectKey,
  submissionSchema,
} from "@/lib/submission";
import { getDb } from "@/services";
import { extractDocument } from "@/services/extractor";

// Public: the token is the credential. Unknown and revoked tokens get the same answer.
// POST keeps the token out of the server function URL.
const tokenSchema = z.object({ token: z.string() });

async function activeInvitation(token: string) {
  return and(
    eq(invitation.tokenHash, await hashInvitationToken(token)),
    isNull(invitation.revokedAt)
  );
}

// Lets a returning employee pick up where they left off. R2 keys never leave the server.
async function uploadedDocuments(invitationId: string) {
  const db = getDb();

  const [documents, extractions] = await Promise.all([
    db
      .select({ kind: document.kind, fileName: document.fileName })
      .from(document)
      .where(eq(document.invitationId, invitationId)),
    db
      .select({
        kind: extraction.kind,
        status: extraction.status,
        fields: extraction.fields,
        warnings: extraction.warnings,
      })
      .from(extraction)
      .where(eq(extraction.invitationId, invitationId)),
  ]);

  const extractionByKind = new Map(
    extractions.map(({ kind, ...result }) => [kind, result])
  );

  const uploaded: UploadedDocuments = {};

  for (const { kind, fileName } of documents) {
    uploaded[kind] = {
      fileName,
      extraction: extractionByKind.get(kind) ?? FAILED_EXTRACTION,
    };
  }

  return uploaded;
}

// Read-only so link scanners that only fetch HTML do not count as an open.
export const checkInvitation = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(async ({ data }) => {
    const [found] = await getDb()
      .select({
        id: invitation.id,
        employeeName: invitation.employeeName,
        submittedAt: invitation.submittedAt,
      })
      .from(invitation)
      .where(await activeInvitation(data.token))
      .limit(1);

    if (!found) {
      return { status: "unavailable" } as const;
    }

    if (found.submittedAt) {
      return { status: "submitted" } as const;
    }

    return {
      status: "open",
      employeeName: found.employeeName,
      documents: await uploadedDocuments(found.id),
    } as const;
  });

export const openInvitation = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(async ({ data }) => {
    await getDb()
      .update(invitation)
      .set({ openedAt: sql`coalesce(${invitation.openedAt}, ${Date.now()})` })
      .where(await activeInvitation(data.token));
  });

const UNAVAILABLE_MESSAGE =
  "Este enlace ya no está disponible. Pide uno nuevo a Recursos Humanos.";

async function findOpenInvitation(token: string) {
  const [found] = await getDb()
    .select({ id: invitation.id, submittedAt: invitation.submittedAt })
    .from(invitation)
    .where(await activeInvitation(token))
    .limit(1);

  if (!found || found.submittedAt) {
    throw new Error(UNAVAILABLE_MESSAGE);
  }

  return found;
}

function parseUploadForm(form: FormData) {
  const token = z.string().min(1).safeParse(form.get("token"));
  const kind = z.enum(DOCUMENT_KIND_LIST).safeParse(form.get("kind"));

  if (!token.success || !kind.success) {
    throw new Error("Revisa los datos e inténtalo de nuevo.");
  }

  const file = documentFileSchema.safeParse(form.get("file"));

  if (!file.success) {
    throw new Error(file.error.issues[0].message);
  }

  return { token: token.data, kind: kind.data, file: file.data };
}

// Runs as soon as the employee picks a file, so the form can be prefilled while they keep going.
// Uploading again replaces the document: same R2 key, same rows.
export const uploadDocument = createServerFn({ method: "POST" })
  .validator(parseUploadForm)
  .handler(async ({ data: { token, kind, file } }) => {
    const [found, bytes] = await Promise.all([
      findOpenInvitation(token),
      file.arrayBuffer(),
    ]);

    const contentType = detectDocumentType(new Uint8Array(bytes.slice(0, 8)));

    if (!contentType) {
      throw new Error("Sube un archivo PDF.");
    }

    const objectKey = employeeObjectKey(found.id, kind);

    await ENV.DOCUMENTS.put(objectKey, bytes, {
      httpMetadata: { contentType },
    });

    const result = await extractDocument(kind, bytes);
    const db = getDb();

    // Together, so a document is never listed with the extraction of the one it replaced.
    await db.batch([
      db
        .insert(document)
        .values({
          invitationId: found.id,
          kind,
          objectKey,
          fileName: file.name,
          contentType,
          size: file.size,
        })
        .onConflictDoUpdate({
          target: [document.invitationId, document.kind],
          set: {
            fileName: file.name,
            contentType,
            size: file.size,
            uploadedAt: new Date(),
          },
        }),
      db
        .insert(extraction)
        .values({ invitationId: found.id, kind, ...result })
        .onConflictDoUpdate({
          target: [extraction.invitationId, extraction.kind],
          set: { ...result, extractedAt: new Date() },
        }),
    ]);

    return { fileName: file.name, extraction: result };
  });

function parseSubmissionForm(form: FormData) {
  const token = z.string().min(1).safeParse(form.get("token"));

  const fields = submissionSchema.safeParse(
    Object.fromEntries(
      Object.keys(submissionSchema.shape).map((name) => [name, form.get(name)])
    )
  );

  if (!token.success || !fields.success) {
    // Messages come from the schema and never echo the submitted values.
    throw new Error(
      fields.error?.issues[0]?.message ??
        "Revisa los datos e inténtalo de nuevo."
    );
  }

  return { token: token.data, fields: fields.data };
}

export const submitInvitation = createServerFn({ method: "POST" })
  .validator(parseSubmissionForm)
  .handler(async ({ data: { token, fields } }) => {
    const db = getDb();
    const found = await findOpenInvitation(token);

    const uploaded = await db
      .select({ kind: document.kind })
      .from(document)
      .where(eq(document.invitationId, found.id));

    const missing = DOCUMENT_KIND_LIST.find(
      (kind) => !uploaded.some((row) => row.kind === kind)
    );

    if (missing) {
      throw new Error(`Sube tu documento: ${DOCUMENT_KINDS[missing].label}.`);
    }

    const [marked] = await db.batch([
      db
        .update(invitation)
        .set({ submittedAt: new Date() })
        .where(
          and(eq(invitation.id, found.id), isNull(invitation.submittedAt))
        ),
      db.insert(submission).values({
        invitationId: found.id,
        ...fields,
        intNumber: fields.intNumber || null,
      }),
    ]);

    return { ok: marked.meta.changes === 1 };
  });
