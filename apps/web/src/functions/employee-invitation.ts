import { invitation } from "@horkos/db/schema/invitation";
import { document, extraction, submission } from "@horkos/db/schema/submission";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import type { UploadedDocuments } from "@/lib/document-upload";
import { FAILED_EXTRACTION } from "@/lib/extraction";
import { hashInvitationToken } from "@/lib/invitation";
import { POSTAL_CODE_REGEX, applyPostalCode } from "@/lib/postal-code";
import {
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LIST,
  employeeObjectKey,
  isEmployeeDocumentKind,
  parseDocumentFile,
  submissionSchema,
} from "@/lib/submission";
import { getDb } from "@/services";
import { storeDocument } from "@/services/document-storage";
import { extractDocument } from "@/services/extractor";
import { lookupPostalCode } from "@/services/sepomex";

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
    // HR's own documents never reach the employee.
    if (!isEmployeeDocumentKind(kind)) {
      continue;
    }

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

  return {
    token: token.data,
    kind: kind.data,
    file: parseDocumentFile(form.get("file")),
  };
}

// Runs as soon as the employee picks a file, so the form can be prefilled while they keep going.
// Uploading again replaces the document.
export const uploadDocument = createServerFn({ method: "POST" })
  .validator(parseUploadForm)
  .handler(async ({ data: { token, kind, file } }) => {
    const [found, bytes] = await Promise.all([
      findOpenInvitation(token),
      file.arrayBuffer(),
    ]);

    const result = await storeDocument({
      invitationId: found.id,
      kind,
      objectKey: employeeObjectKey(found.id, kind, crypto.randomUUID()),
      file,
      bytes,
      read: (content) => extractDocument(kind, content),
    });

    return { fileName: file.name, extraction: result };
  });

// Behind the token so the endpoint is not an open proxy to the catalog.
export const findPostalCode = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string(),
      postalCode: z.string().regex(POSTAL_CODE_REGEX),
    })
  )
  .handler(async ({ data }) => {
    await findOpenInvitation(data.token);

    return lookupPostalCode(data.postalCode);
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

// Turns plain values into a selection, so `INSERT ... SELECT` can bind them next to columns.
function asSelection<T extends Record<string, unknown>>(values: T) {
  // SAFETY: every entry keeps its key and wraps its own value, which is what the mapped type says.
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      sql`${value}`.as(name),
    ])
  ) as { [K in keyof T]: SQL.Aliased<T[K]> };
}

export const submitInvitation = createServerFn({ method: "POST" })
  .validator(parseSubmissionForm)
  .handler(async ({ data: { token, fields: typed } }) => {
    const db = getDb();
    const found = await findOpenInvitation(token);

    const checked = applyPostalCode(
      typed,
      await lookupPostalCode(typed.postalCode)
    );

    if (!checked.ok) {
      throw new Error(checked.message);
    }

    const { fields } = checked;

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

    // Both statements check the invitation is still open, so a revocation or a second
    // submit that lands after `findOpenInvitation` leaves nothing behind.
    const stillOpen = and(
      eq(invitation.id, found.id),
      isNull(invitation.revokedAt),
      isNull(invitation.submittedAt)
    );

    const values = { ...fields, intNumber: fields.intNumber || null };

    const [, marked] = await db.batch([
      db.insert(submission).select(
        db
          .select({
            invitationId: invitation.id,
            ...asSelection(values),
          })
          .from(invitation)
          .where(stillOpen)
      ),
      db.update(invitation).set({ submittedAt: new Date() }).where(stillOpen),
    ]);

    return { ok: marked.meta.changes === 1 };
  });
