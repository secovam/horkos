import { defineRelationsPart, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const invitation = sqliteTable(
  "invitation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    employeeName: text("employee_name").notNull(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    openedAt: integer("opened_at", { mode: "timestamp_ms" }),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    hrCompletedAt: integer("hr_completed_at", { mode: "timestamp_ms" }),
    contractGeneratedAt: integer("contract_generated_at", {
      mode: "timestamp_ms",
    }),
  },
  (table) => [
    uniqueIndex("invitation_active_email_idx")
      .on(table.email)
      .where(sql`revoked_at is null`),
    index("invitation_created_at_idx").on(table.createdAt),
  ]
);

export const invitationRelations = defineRelationsPart(
  { user, invitation },
  (r) => ({
    invitation: {
      creator: r.one.user({
        from: r.invitation.createdBy,
        to: r.user.id,
      }),
    },
  })
);
