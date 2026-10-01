import { invitation } from "@horkos/db/schema/invitation";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { hashInvitationToken } from "@/lib/invitation";
import { getDb } from "@/services";

// Public: the token is the credential. Unknown and revoked tokens get the same answer.
export const openInvitation = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const [opened] = await getDb()
      .update(invitation)
      .set({ openedAt: sql`coalesce(${invitation.openedAt}, ${Date.now()})` })
      .where(
        and(
          eq(invitation.tokenHash, await hashInvitationToken(data.token)),
          isNull(invitation.revokedAt)
        )
      )
      .returning({ id: invitation.id });

    return { valid: opened !== undefined };
  });
