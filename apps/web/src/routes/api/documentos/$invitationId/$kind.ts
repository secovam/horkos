import { document } from "@horkos/db/schema/submission";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { ENV } from "@/env.server";
import { STORED_DOCUMENT_KIND_LIST } from "@/lib/submission";
import { createAuth, getDb } from "@/services";

const ASCII_UNSAFE_REGEX = /[^\w.-]/gu;

const RFC_5987_RESERVED_REGEX = /['()*]/gu;

// `filename*` carries the real name; the quoted fallback is for clients that ignore it.
function inlineDisposition(fileName: string) {
  const fallback = fileName.replaceAll(ASCII_UNSAFE_REGEX, "_");

  const encoded = encodeURIComponent(fileName).replaceAll(
    RFC_5987_RESERVED_REGEX,
    (char) => `%${char.codePointAt(0)?.toString(16).toUpperCase()}`
  );

  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function isDocumentKind(
  value: string
): value is (typeof STORED_DOCUMENT_KIND_LIST)[number] {
  return STORED_DOCUMENT_KIND_LIST.some((kind) => kind === value);
}

export const Route = createFileRoute("/api/documentos/$invitationId/$kind")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await createAuth();
        const session = await auth.api.getSession({ headers: request.headers });

        if (!session) {
          return new Response(null, { status: 401 });
        }

        if (!isDocumentKind(params.kind)) {
          return new Response(null, { status: 404 });
        }

        const [found] = await getDb()
          .select({
            objectKey: document.objectKey,
            fileName: document.fileName,
            contentType: document.contentType,
          })
          .from(document)
          .where(
            and(
              eq(document.invitationId, params.invitationId),
              eq(document.kind, params.kind)
            )
          );

        const object = found ? await ENV.DOCUMENTS.get(found.objectKey) : null;

        if (!found || !object) {
          return new Response(null, { status: 404 });
        }

        return new Response(object.body, {
          headers: {
            "Content-Type": found.contentType,
            "Content-Disposition": inlineDisposition(found.fileName),
            "Content-Length": String(object.size),
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
