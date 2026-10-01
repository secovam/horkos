import { invitation } from "@horkos/db/schema/invitation";
import { and, isNotNull, isNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { SQLiteAsyncDatabase } from "drizzle-orm/sqlite-core";

// Every metric counts only non-revoked invitations; `filter` narrows within them.
export const INVITATION_METRICS = [
  {
    key: "sent",
    label: "Invitaciones enviadas",
    filter: isNotNull(invitation.sentAt),
  },
  {
    key: "opened",
    label: "Invitaciones abiertas",
    filter: isNotNull(invitation.openedAt),
  },
  {
    key: "submitted",
    label: "Empleados que terminaron de llenar su información",
    filter: isNotNull(invitation.submittedAt),
  },
  {
    key: "awaitingHr",
    label: "Empleados pendientes de información de RH",
    filter: and(
      isNotNull(invitation.submittedAt),
      isNull(invitation.hrCompletedAt)
    ),
  },
  {
    key: "awaitingContract",
    label: "Contratos pendientes de generar",
    filter: and(
      isNotNull(invitation.hrCompletedAt),
      isNull(invitation.contractGeneratedAt)
    ),
  },
] as const satisfies { key: string; label: string; filter: SQL | undefined }[];

export type InvitationMetricKey = (typeof INVITATION_METRICS)[number]["key"];

export async function countInvitationMetrics(
  db: SQLiteAsyncDatabase<"sync" | "async", unknown>
) {
  const columns = Object.fromEntries(
    INVITATION_METRICS.map(({ key, filter }) => [
      key,
      sql`count(*) filter (where ${filter})`.mapWith(Number),
    ])
  );

  const [counts] = await db
    .select(columns)
    .from(invitation)
    .where(isNull(invitation.revokedAt));

  // SAFETY: columns has exactly one numeric entry per INVITATION_METRICS key.
  return counts as Record<InvitationMetricKey, number>;
}
