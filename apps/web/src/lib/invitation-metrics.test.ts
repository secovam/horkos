import { fileURLToPath } from "node:url";

import { invitation } from "@horkos/db/schema/invitation";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { expect, test } from "vitest";

import { countInvitationMetrics } from "./invitation-metrics";

const at = new Date("2026-01-15T10:00:00Z");

let sequence = 0;

type Stage =
  | "openedAt"
  | "submittedAt"
  | "hrCompletedAt"
  | "contractGeneratedAt"
  | "revokedAt";

function row(
  dates: Partial<Record<Stage, Date>>
): typeof invitation.$inferInsert {
  sequence += 1;

  return {
    employeeName: `Empleado Ficticio ${sequence}`,
    email: `empleado${sequence}@example.com`,
    tokenHash: `hash-${sequence}`,
    sentAt: at,
    ...dates,
  };
}

test("each metric counts the non-revoked invitations at its stage", async () => {
  const db = drizzle(":memory:");

  migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL("../../../../packages/db/src/migrations", import.meta.url)
    ),
  });

  await db.insert(invitation).values([
    row({}),
    row({ openedAt: at }),
    row({ openedAt: at, submittedAt: at }),
    row({ openedAt: at, submittedAt: at, hrCompletedAt: at }),
    row({
      openedAt: at,
      submittedAt: at,
      hrCompletedAt: at,
      contractGeneratedAt: at,
    }),
    row({
      revokedAt: at,
      openedAt: at,
      submittedAt: at,
      hrCompletedAt: at,
    }),
  ]);

  expect(await countInvitationMetrics(db)).toStrictEqual({
    sent: 5,
    opened: 4,
    submitted: 3,
    awaitingHr: 1,
    awaitingContract: 1,
  });
});
