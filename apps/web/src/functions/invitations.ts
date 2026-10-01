import { invitation } from "@horkos/db/schema/invitation";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { ENV } from "@/env.server";
import {
  INVITATIONS_PAGE_SIZE,
  escapeLikePattern,
  generateInvitationToken,
  hashInvitationToken,
  invitationSearchSchema,
  newInvitationSchema,
} from "@/lib/invitation";
import { requireSessionMiddleware } from "@/middleware/auth";
import { getDb } from "@/services";
import { sendInvitationEmail } from "@/services/email";

const TAB_FILTER = {
  active: isNull(invitation.revokedAt),
  revoked: isNotNull(invitation.revokedAt),
};

function searchFilter(q: string) {
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

async function emailInvitation(
  token: string,
  { email, employeeName }: { email: string; employeeName: string }
) {
  try {
    await sendInvitationEmail(ENV.EMAIL, ENV.EMAIL_FROM, {
      email,
      employeeName,
      url: `${ENV.BETTER_AUTH_URL}/invitacion/${token}`,
    });
  } catch {
    throw new Error(
      "La invitación se guardó, pero no se pudo enviar el correo. Intenta reenviarla."
    );
  }
}

// POST keeps search terms and employee data out of request URLs and logs.
export const listInvitations = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(invitationSearchSchema)
  .handler(async ({ data: { tab, q, page } }) => {
    const db = getDb();
    const search = searchFilter(q);

    const [rows, [counts]] = await Promise.all([
      db
        .select({
          id: invitation.id,
          employeeName: invitation.employeeName,
          email: invitation.email,
          sentAt: invitation.sentAt,
          revokedAt: invitation.revokedAt,
          submittedAt: invitation.submittedAt,
        })
        .from(invitation)
        .where(and(TAB_FILTER[tab], search))
        .orderBy(desc(invitation.createdAt))
        .limit(INVITATIONS_PAGE_SIZE)
        .offset((page - 1) * INVITATIONS_PAGE_SIZE),
      db
        .select({
          active:
            sql`coalesce(sum(${invitation.revokedAt} is null), 0)`.mapWith(
              Number
            ),
          revoked:
            sql`coalesce(sum(${invitation.revokedAt} is not null), 0)`.mapWith(
              Number
            ),
        })
        .from(invitation)
        .where(search),
    ]);

    return { rows, counts, total: counts[tab] };
  });

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(newInvitationSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();

    const active = await db.query.invitation.findFirst({
      columns: { id: true },
      where: { email: data.email, revokedAt: { isNull: true } },
    });

    if (active) {
      throw new Error("Ya existe una invitación activa para este correo.");
    }

    const token = generateInvitationToken();

    await db.insert(invitation).values({
      ...data,
      tokenHash: await hashInvitationToken(token),
      createdBy: context.session.user.id,
      sentAt: new Date(),
    });

    await emailInvitation(token, data);
  });

const invitationIdSchema = z.object({ id: z.string().min(1) });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(invitationIdSchema)
  .handler(async ({ data }) => {
    const token = generateInvitationToken();

    const [updated] = await getDb()
      .update(invitation)
      .set({ tokenHash: await hashInvitationToken(token), sentAt: new Date() })
      .where(and(eq(invitation.id, data.id), isNull(invitation.revokedAt)))
      .returning({
        email: invitation.email,
        employeeName: invitation.employeeName,
      });

    if (!updated) {
      throw new Error("Solo se pueden reenviar invitaciones activas.");
    }

    await emailInvitation(token, updated);
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(invitationIdSchema)
  .handler(async ({ data }) => {
    const [revoked] = await getDb()
      .update(invitation)
      .set({ revokedAt: new Date() })
      .where(and(eq(invitation.id, data.id), isNull(invitation.revokedAt)))
      .returning({ id: invitation.id });

    if (!revoked) {
      throw new Error("La invitación ya estaba revocada.");
    }
  });
