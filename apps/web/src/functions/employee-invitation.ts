import { invitation } from "@horkos/db/schema/invitation";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { hashInvitationToken } from "@/lib/invitation";
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
      .select({ id: invitation.id })
      .from(invitation)
      .where(await activeInvitation(data.token))
      .limit(1);

    return { valid: found !== undefined };
  });

export const openInvitation = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(async ({ data }) => {
    await getDb()
      .update(invitation)
      .set({ openedAt: sql`coalesce(${invitation.openedAt}, ${Date.now()})` })
      .where(await activeInvitation(data.token));
  });
