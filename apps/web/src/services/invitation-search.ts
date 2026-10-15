import { invitation } from "@horkos/db/schema/invitation";
import { or, sql } from "drizzle-orm";

import { escapeLikePattern } from "@/lib/invitation";

export function searchFilter(q: string) {
  const term = q.trim();

  if (!term) {
    return;
  }

  const pattern = `%${escapeLikePattern(term)}%`;

  return or(
    sql`${invitation.employeeName} like ${pattern} escape '\\'`,
    sql`${invitation.email} like ${pattern} escape '\\'`
  );
}
