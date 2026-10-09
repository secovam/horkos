import evlog from "evlog/nitro/v3";
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
  experimental: {
    asyncContext: true,
  },
  modules: [
    evlog({
      env: { service: "horkos-web" },
      // Invitation links carry their token in the path.
      redact: { patterns: [/(?<=\/invitacion\/)[^/?#]+/gu] },
    }),
  ],
});
