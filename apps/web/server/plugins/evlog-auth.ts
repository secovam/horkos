import type { RequestLogger } from "evlog";
import { createAuthIdentifier } from "evlog/better-auth";
import type { BetterAuthInstance } from "evlog/better-auth";
import { definePlugin } from "nitro";

import { createAuth } from "../../src/services";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("request", async (event) => {
    const auth = await createAuth();

    const identify = createAuthIdentifier(
      // SAFETY: createAuth returns a better-auth instance, which satisfies BetterAuthInstance.
      auth as BetterAuthInstance,
      {
        exclude: ["/api/auth/**"],
        maskEmail: true,
      }
    );

    await identify({
      path: new URL(event.req.url).pathname,
      headers: event.req.headers,
      // SAFETY: evlog's Nitro v3 plugin stores the request logger at req.context.log.
      context: (event.req.context ?? {}) as { log?: RequestLogger },
    });
  });
});
