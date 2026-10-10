import handler from "@tanstack/react-start/server-entry";

import { workerHandlers } from "@/worker-handlers";

// Worker entry (`main` in alchemy.run.ts): TanStack Start only exports `fetch`, and the
// cron and the queue consumer need `scheduled` and `queue` on the same default export.
export default {
  fetch: (request: Request) => handler.fetch(request),
  ...workerHandlers,
} satisfies ExportedHandler;
