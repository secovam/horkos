import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Self-registered from the public page. Kept apart from `invitation` so the cron never
// emails anyone HR has not reviewed; "Invitar a todos" moves rows into `invitation`.
export const registration = sqliteTable(
  "registration",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    employeeName: text("employee_name").notNull(),
    email: text("email").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("registration_email_idx").on(table.email),
    index("registration_created_at_idx").on(table.createdAt),
  ]
);
