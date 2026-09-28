import { createAuthIdentifier } from "evlog/better-auth";
import type { BetterAuthInstance } from "evlog/better-auth";

import { createAuth } from "../../src/services";

export default defineNitroPlugin((nitroApp) => {
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
    await identify(event);
  });
});
