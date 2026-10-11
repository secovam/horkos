import {
  enqueuePendingInvitations,
  processInvitationBatch,
} from "@/services/invitation-queue";

// Bindings come from `cloudflare:workers`, so the handler arguments are not needed.
export const workerHandlers = {
  scheduled: () => enqueuePendingInvitations(),
  queue: (batch: MessageBatch) => processInvitationBatch(batch),
} satisfies ExportedHandler;
