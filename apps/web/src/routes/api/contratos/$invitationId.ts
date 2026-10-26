import { employment } from "@horkos/db/schema/employment";
import { invitation } from "@horkos/db/schema/invitation";
import { submission } from "@horkos/db/schema/submission";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { contentDisposition } from "@/lib/content-disposition";
import { contractFields, fillContract, isContractReady } from "@/lib/contract";
import { createAuth, getDb } from "@/services";

export const Route = createFileRoute("/api/contratos/$invitationId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await createAuth();
        const session = await auth.api.getSession({ headers: request.headers });

        if (!session) {
          return new Response(null, { status: 401 });
        }

        // Only a record HR confirmed becomes a contract.
        const [found] = await getDb()
          .select({ record: submission, job: employment })
          .from(invitation)
          .innerJoin(submission, eq(submission.invitationId, invitation.id))
          .innerJoin(employment, eq(employment.invitationId, invitation.id))
          .where(
            and(
              eq(invitation.id, params.invitationId),
              isNotNull(invitation.hrCompletedAt),
              isNull(invitation.revokedAt)
            )
          );

        if (!found) {
          return new Response(null, { status: 404 });
        }

        const { record, job } = found;

        if (!isContractReady(record)) {
          return new Response(
            "Faltan el estado civil o el beneficiario. Reabre el expediente y complétalos.",
            {
              status: 409,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            }
          );
        }

        const pdf = await fillContract(contractFields(record, job, new Date()));

        return new Response(pdf, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": contentDisposition(
              "attachment",
              `Contrato ${record.fullName}.pdf`
            ),
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
