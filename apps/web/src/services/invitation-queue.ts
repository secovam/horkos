import { invitation } from "@horkos/db/schema/invitation";
import { and, asc, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";

import { ENV } from "@/env.server";
import { generateInvitationToken, hashInvitationToken } from "@/lib/invitation";
import { getDb } from "@/services";
import { deliverInvitation } from "@/services/invitation-delivery";

const ENQUEUE_LIMIT = 100;

// enqueued_at means the queue owns the row until an email is confirmed sent, then it is cleared.
// This is far past a message's whole retry chain (5 retries, 60 s apart), so a row owned this long
// lost its message: the Worker died before sendBatch or the queue gave up. A duplicate is
// harmless, since the first message to confirm a send releases the row for the rest.
const STALE_CLAIM_MS = 60 * 60 * 1000;

// D1 caps bound parameters per statement at 100.
const RESET_CHUNK = 50;

const queueMessageSchema = z.object({ invitationId: z.string().min(1) });

type QueueMessage = z.infer<typeof queueMessageSchema>;

function chunk<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  );
}

export async function enqueuePendingInvitations() {
  const db = getDb();

  const unclaimed = or(
    and(isNull(invitation.sentAt), isNull(invitation.enqueuedAt)),
    lt(invitation.enqueuedAt, new Date(Date.now() - STALE_CLAIM_MS))
  );

  const oldestPending = db
    .select({ id: invitation.id })
    .from(invitation)
    .where(and(unclaimed, isNull(invitation.revokedAt)))
    .orderBy(asc(invitation.createdAt))
    .limit(ENQUEUE_LIMIT);

  // One statement picks and marks the rows, so overlapping crons never claim the same one.
  const claimed = await db
    .update(invitation)
    .set({ enqueuedAt: new Date() })
    .where(and(inArray(invitation.id, oldestPending), unclaimed))
    .returning({ id: invitation.id });

  if (claimed.length === 0) {
    return;
  }

  const ids = claimed.map(({ id }) => id);

  try {
    await ENV.INVITATION_QUEUE.sendBatch(
      ids.map((invitationId) => ({
        body: { invitationId } satisfies QueueMessage,
      }))
    );
  } catch (error) {
    await Promise.all(
      chunk(ids, RESET_CHUNK).map((group) =>
        db
          .update(invitation)
          .set({ enqueuedAt: null })
          .where(inArray(invitation.id, group))
      )
    );

    throw error;
  }
}

async function sendQueuedInvitation(invitationId: string) {
  const db = getDb();
  const token = generateInvitationToken();
  const tokenHash = await hashInvitationToken(token);

  // A hash left by a send that failed and could not roll back is reclaimed here, since the queue
  // still owns the row. A send from the dashboard releases it, so that message loses.
  const [claimed] = await db
    .update(invitation)
    .set({ tokenHash, sentAt: new Date() })
    .where(
      and(
        eq(invitation.id, invitationId),
        isNotNull(invitation.enqueuedAt),
        isNull(invitation.revokedAt)
      )
    )
    .returning({
      email: invitation.email,
      employeeName: invitation.employeeName,
    });

  if (!claimed) {
    return;
  }

  try {
    await deliverInvitation(token, claimed);
  } catch (error) {
    // Best effort, so the dashboard shows it queued again; the retry reclaims it either way.
    await db
      .update(invitation)
      .set({ tokenHash: null, sentAt: null })
      .where(
        and(
          eq(invitation.id, invitationId),
          eq(invitation.tokenHash, tokenHash)
        )
      );

    throw error;
  }

  // If this fails the retry sends again: a second email beats none.
  await db
    .update(invitation)
    .set({ enqueuedAt: null })
    .where(
      and(eq(invitation.id, invitationId), eq(invitation.tokenHash, tokenHash))
    );
}

async function processMessage(message: Message) {
  const body = queueMessageSchema.safeParse(message.body);

  if (!body.success) {
    // A malformed message can never succeed, so retrying would only delay the queue.
    message.ack();

    return;
  }

  try {
    await sendQueuedInvitation(body.data.invitationId);
    message.ack();
  } catch {
    message.retry();
  }
}

export async function processInvitationBatch(batch: MessageBatch) {
  for (const message of batch.messages) {
    // oxlint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- Sequential on purpose: this is the email throttle.
    await processMessage(message);
  }
}
