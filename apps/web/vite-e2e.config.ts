import { mergeConfig, defineConfig } from "vite";

import config from "./vite.config.ts";

export default mergeConfig(
  config,
  defineConfig({
    ssr: {
      target: "webworker",
      noExternal: true,
      resolve: { conditions: ["workerd", "node", "production"] },
    },
  })
);
