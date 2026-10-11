import { invitation } from "@horkos/db/schema/invitation";
import { document, submission } from "@horkos/db/schema/submission";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { ENV } from "@/env.server";
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

// Public: the token is the credential. Unknown and revoked tokens get the same answer.
// POST keeps the token out of the server function URL.
const tokenSchema = z.object({ token: z.string() });

async function activeInvitation(token: string) {
  return and(
    eq(invitation.tokenHash, await hashInvitationToken(token)),
    isNull(invitation.revokedAt)
  );
}

// Read-only so link scanners that only fetch HTML do not count as an open.
export const checkInvitation = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(async ({ data }) => {
    const [found] = await getDb()
      .select({
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

    return { status: "open", employeeName: found.employeeName } as const;
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

  const files = DOCUMENT_KIND_LIST.map((kind) => {
    const file = documentFileSchema.safeParse(form.get(`file_${kind}`));

    if (!file.success) {
      throw new Error(
        `${DOCUMENT_KINDS[kind].label}: ${file.error.issues[0].message}`
      );
    }

    return { kind, file: file.data };
  });

  return { token: token.data, fields: fields.data, files };
}

async function readDocument(
  kind: (typeof DOCUMENT_KIND_LIST)[number],
  file: File
) {
  const { label } = DOCUMENT_KINDS[kind];
  const bytes = await file.arrayBuffer();
  const contentType = detectDocumentType(new Uint8Array(bytes.slice(0, 8)));

  if (!contentType) {
    throw new Error(`${label}: sube un archivo PDF.`);
  }

  return { kind, bytes, contentType, fileName: file.name, size: file.size };
}

export const submitInvitation = createServerFn({ method: "POST" })
  .validator(parseSubmissionForm)
  .handler(async ({ data: { token, fields, files } }) => {
    const db = getDb();

    const [found] = await db
      .select({ id: invitation.id, submittedAt: invitation.submittedAt })
      .from(invitation)
      .where(await activeInvitation(token))
      .limit(1);

    if (!found || found.submittedAt) {
      throw new Error(UNAVAILABLE_MESSAGE);
    }

    const documents = await Promise.all(
      files.map(({ kind, file }) => readDocument(kind, file))
    );

    // Same keys on a retry, so a failed first attempt is overwritten, not orphaned.
    await Promise.all(
      documents.map(({ kind, bytes, contentType }) =>
        ENV.DOCUMENTS.put(employeeObjectKey(found.id, kind), bytes, {
          httpMetadata: { contentType },
        })
      )
    );

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
      db.insert(document).values(
        documents.map(({ kind, contentType, fileName, size }) => ({
          invitationId: found.id,
          kind,
          objectKey: employeeObjectKey(found.id, kind),
          fileName,
          contentType,
          size,
        }))
      ),
    ]);

    return { ok: marked.meta.changes === 1 };
  });
