import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    // oxlint-disable-next-line typescript/no-non-null-assertion
    ...ultracite.ignorePatterns!,
    "packages/ui/**",
    "packages/db/src/migrations/**",
    ".agents/**",
    ".claude/**",
    "tools/oxlint/anti-slop/**",
    "**/CLAUDE.md",
  ],
});
