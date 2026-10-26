import { invitation } from "@horkos/db/schema/invitation";
import { or, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

import { escapeLikePattern } from "@/lib/invitation";

export function searchFilter(
  q: string,
  table: { employeeName: SQLiteColumn; email: SQLiteColumn } = invitation
) {
  const term = q.trim();

  if (!term) {
    return;
  }

  const pattern = `%${escapeLikePattern(term)}%`;

  return or(
    sql`${table.employeeName} like ${pattern} escape '\\'`,
    sql`${table.email} like ${pattern} escape '\\'`
  );
}
