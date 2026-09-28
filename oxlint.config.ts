import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";
import tanstack from "ultracite/oxlint/tanstack";
import tanstackJsPlugins from "ultracite/oxlint/tanstack/js-plugins";

const jsPlugins = selectJsPlugins(["github", "sonarjs", "react-doctor"]);

export default defineConfig({
  extends: [
    core,
    react,
    tanstack,
    tanstackJsPlugins,
    shadcn,
    antiSlop,
    jsPlugins,
  ],
  ignorePatterns: [
    // oxlint-disable-next-line typescript/no-non-null-assertion
    ...core.ignorePatterns!,
    "packages/ui/**",
    ".agents/skills/**",
    ".claude/skills/**",
  ],
  jsPlugins: [
    // oxlint-disable-next-line typescript/no-non-null-assertion
    ...jsPlugins.jsPlugins!,
    // oxlint-disable-next-line typescript/no-non-null-assertion
    ...shadcn.jsPlugins!,
  ],
  settings: jsPluginSettings,
  overrides: [
    {
      files: ["packages/db/src/index.ts", "packages/db/src/schema/index.ts"],
      rules: {
        "oxc/no-barrel-file": "off",
        "sonarjs/no-wildcard-import": "off",
      },
    },
    {
      files: [
        "packages/db/src/relations.ts",
        "packages/auth/src/index.ts",
        "packages/infra/alchemy.run.ts",
      ],
      rules: {
        "sonarjs/no-wildcard-import": "off",
      },
    },
    {
      files: ["packages/infra/alchemy.run.ts"],
      rules: {
        "func-names": "off",
      },
    },
    {
      files: ["apps/web/cloudflare-env.d.ts", "apps/web/src/env.server.ts"],
      rules: {
        "sonarjs/redundant-type-aliases": "off",
        "typescript/no-empty-interface": "off",
        "typescript/no-empty-object-type": "off",
        "typescript/triple-slash-reference": "off",
      },
    },
    {
      files: ["packages/db/src/schema/**/*.ts"],
      rules: {
        "sort-keys": "off",
      },
    },
    {
      files: ["apps/web/src/routes/**/*.{ts,tsx}"],
      rules: {
        "func-style": "off",
        "github/filenames-match-regex": "off",
        "sonarjs/function-name": "off",
      },
    },
    {
      files: ["apps/web/src/components/**/*.{ts,tsx}"],
      rules: {
        "func-style": "off",
      },
    },
  ],
  rules: {
    "func-style": ["error", "declaration"],
    "react/function-component-definition": [
      "error",
      {
        namedComponents: "function-declaration",
        unnamedComponents: "function-expression",
      },
    ],
  },
});
