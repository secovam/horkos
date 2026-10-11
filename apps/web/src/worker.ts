import handler from "@tanstack/react-start/server-entry";
import { createAuthIdentifier } from "evlog/better-auth";
import type { BetterAuthInstance } from "evlog/better-auth";
import { initWorkersLogger, withEvlog } from "evlog/workers";

import { createAuth } from "@/services";
import { workerHandlers } from "@/worker-handlers";

initWorkersLogger({
  env: { service: "horkos-web" },
  // Set here, not on withEvlog: only the global config also scrubs console output.
  // Invitation links carry their token in the path.
  redact: { patterns: [/(?<=\/invitacion\/)[^/?#]+/gu] },
});

const { fetch } = withEvlog(async (request, _env, _ctx, log) => {
  const identify = createAuthIdentifier(
    // SAFETY: createAuth returns a better-auth instance, which satisfies BetterAuthInstance.
    (await createAuth()) as BetterAuthInstance,
    { exclude: ["/api/auth/**"], maskEmail: true }
  );

  await identify({
    path: new URL(request.url).pathname,
    headers: request.headers,
    context: { log },
  });

  return handler.fetch(request);
});

// Worker entry (`main` in alchemy.run.ts): TanStack Start only exports `fetch`, and the
// cron and the queue consumer need `scheduled` and `queue` on the same default export.
export default { fetch, ...workerHandlers } satisfies ExportedHandler;
