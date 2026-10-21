import { invitation } from "@horkos/db/schema/invitation";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import {
  INVITATIONS_PAGE_SIZE,
  generateInvitationToken,
  hashInvitationToken,
  listInvitationsSchema,
  newInvitationSchema,
} from "@/lib/invitation";
import { countInvitationMetrics } from "@/lib/invitation-metrics";
import { PublicError } from "@/lib/public-error";
import { requireSessionMiddleware } from "@/middleware/auth";
import { getDb } from "@/services";
import { deliverInvitation } from "@/services/invitation-delivery";
import { searchFilter } from "@/services/invitation-search";

const TAB_FILTER = {
  active: isNull(invitation.revokedAt),
  revoked: isNotNull(invitation.revokedAt),
};

async function emailInvitation(
  token: string,
  { email, employeeName }: { email: string; employeeName: string }
) {
  try {
    await deliverInvitation(token, { email, employeeName });
  } catch {
    throw new PublicError(
      "La invitación se guardó, pero no se pudo enviar el correo. Intenta reenviarla."
    );
  }
}

// POST keeps search terms and employee data out of request URLs and logs.
export const listInvitations = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(listInvitationsSchema)
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

export const getInvitationMetrics = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .handler(() => countInvitationMetrics(getDb()));

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(newInvitationSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();

    const existing = await db.query.invitation.findFirst({
      columns: { revokedAt: true },
      where: { email: data.email },
    });

    if (existing?.revokedAt) {
      throw new PublicError(
        "Este correo tiene una invitación revocada. Reactívala desde la pestaña Revocadas."
      );
    }

    if (existing) {
      throw new PublicError(
        "Ya existe una invitación activa para este correo."
      );
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
    const tokenHash = await hashInvitationToken(token);

    const db = getDb();

    const [active] = await db
      .select({
        email: invitation.email,
        employeeName: invitation.employeeName,
        tokenHash: invitation.tokenHash,
        sentAt: invitation.sentAt,
        enqueuedAt: invitation.enqueuedAt,
      })
      .from(invitation)
      .where(and(eq(invitation.id, data.id), isNull(invitation.revokedAt)));

    if (!active) {
      throw new PublicError("Solo se pueden reenviar invitaciones activas.");
    }

    // Swapping the hash only while it still matches what we read makes concurrent resends
    // lose before any email goes out, so no recipient gets a link that is already dead.
    // A queued invitation has no hash yet, so the match is on null; this is also "send now".
    // Clearing enqueued_at takes the row from the queue, so a pending message will not send again.
    const [swapped] = await db
      .update(invitation)
      .set({ tokenHash, sentAt: new Date(), enqueuedAt: null })
      .where(
        and(
          eq(invitation.id, data.id),
          active.tokenHash === null
            ? isNull(invitation.tokenHash)
            : eq(invitation.tokenHash, active.tokenHash),
          isNull(invitation.revokedAt)
        )
      )
      .returning({ id: invitation.id });

    if (!swapped) {
      throw new PublicError(
        "La invitación cambió mientras se reenviaba. Intenta de nuevo."
      );
    }

    try {
      await emailInvitation(token, active);
    } catch (error) {
      // Put the previous link back so a failed delivery never leaves the employee without one.
      await db
        .update(invitation)
        .set({
          tokenHash: active.tokenHash,
          sentAt: active.sentAt,
          enqueuedAt: active.enqueuedAt,
        })
        .where(
          and(eq(invitation.id, data.id), eq(invitation.tokenHash, tokenHash))
        );

      throw error;
    }
  });

export const reactivateInvitation = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(invitationIdSchema)
  .handler(async ({ data }) => {
    const db = getDb();

    const [revoked] = await db
      .select({
        email: invitation.email,
        employeeName: invitation.employeeName,
        revokedAt: invitation.revokedAt,
        tokenHash: invitation.tokenHash,
        sentAt: invitation.sentAt,
        enqueuedAt: invitation.enqueuedAt,
      })
      .from(invitation)
      .where(and(eq(invitation.id, data.id), isNotNull(invitation.revokedAt)));

    if (!revoked) {
      throw new PublicError("La invitación ya estaba activa.");
    }

    // The revoked link may have leaked, so reactivating always issues a new one.
    const token = generateInvitationToken();
    const tokenHash = await hashInvitationToken(token);

    const [reactivated] = await db
      .update(invitation)
      .set({ revokedAt: null, tokenHash, sentAt: new Date(), enqueuedAt: null })
      .where(and(eq(invitation.id, data.id), isNotNull(invitation.revokedAt)))
      .returning({ id: invitation.id });

    if (!reactivated) {
      throw new PublicError(
        "La invitación cambió mientras se reactivaba. Intenta de nuevo."
      );
    }

    try {
      await emailInvitation(token, revoked);
    } catch {
      // Revoke again so the employee never holds a live link nobody sent them.
      await db
        .update(invitation)
        .set({
          revokedAt: revoked.revokedAt,
          tokenHash: revoked.tokenHash,
          sentAt: revoked.sentAt,
          enqueuedAt: revoked.enqueuedAt,
        })
        .where(
          and(eq(invitation.id, data.id), eq(invitation.tokenHash, tokenHash))
        );

      throw new PublicError(
        "No se pudo enviar el correo, así que la invitación sigue revocada."
      );
    }
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
      throw new PublicError("La invitación ya estaba revocada.");
    }
  });
