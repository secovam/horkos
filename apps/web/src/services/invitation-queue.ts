import { invitation } from "@horkos/db/schema/invitation";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { ENV } from "@/env.server";
import { generateInvitationToken, hashInvitationToken } from "@/lib/invitation";
import { getDb } from "@/services";
import { deliverInvitation } from "@/services/invitation-delivery";

const ENQUEUE_LIMIT = 100;

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

  const oldestUnsent = db
    .select({ id: invitation.id })
    .from(invitation)
    .where(
      and(
        isNull(invitation.sentAt),
        isNull(invitation.enqueuedAt),
        isNull(invitation.revokedAt)
      )
    )
    .orderBy(asc(invitation.createdAt))
    .limit(ENQUEUE_LIMIT);

  // One statement picks and marks the rows, so overlapping crons never claim the same one.
  const claimed = await db
    .update(invitation)
    .set({ enqueuedAt: new Date() })
    .where(
      and(inArray(invitation.id, oldestUnsent), isNull(invitation.enqueuedAt))
    )
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

  // The null hash is the claim: a resend from the dashboard or a duplicate message loses here.
  const [claimed] = await db
    .update(invitation)
    .set({ tokenHash, sentAt: new Date() })
    .where(
      and(
        eq(invitation.id, invitationId),
        isNull(invitation.tokenHash),
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
