import { defineConfig } from "@coderabbitai/config";

const SOURCE_FILES = "{apps,packages}/**/*.{ts,tsx}";

const REACT_FILES = "{apps/web,packages/ui}/src/**/*.tsx";

export default defineConfig({
  reviews: {
    high_level_summary: false,
    review_status: false,
    auto_review: {
      enabled: true,
    },
    pre_merge_checks: {
      docstrings: { mode: "off" },
    },
    path_filters: [
      // Vendored agent skills and generated files.
      "!.agents/**",
      "!skills-lock.json",
      "!apps/web/src/routeTree.gen.ts",
      "!packages/db/src/migrations/**",
      "!packages/ui/**",
    ],
    path_instructions: [
      {
        path: SOURCE_FILES,
        instructions:
          "Hold changed code to the rules in docs/agents/typescript.md.",
      },
      {
        path: REACT_FILES,
        instructions: "Hold changed code to the rules in docs/agents/react.md.",
      },
    ],
  },
  knowledge_base: {
    code_guidelines: {
      filePatterns: [
        { files: "docs/agents/typescript.md", applyTo: SOURCE_FILES },
        { files: "docs/agents/react.md", applyTo: REACT_FILES },
      ],
    },
  },
});
