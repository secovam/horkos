import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";
import tanstack from "ultracite/oxlint/tanstack";
import tanstackJsPlugins from "ultracite/oxlint/tanstack/js-plugins";

const jsPlugins = selectJsPlugins(["github", "sonarjs", "react-doctor"]);

export default defineConfig({
  extends: [core, react, tanstack, tanstackJsPlugins, shadcn, jsPlugins],
  ignorePatterns: [
    // oxlint-disable-next-line typescript/no-non-null-assertion
    ...core.ignorePatterns!,
    "packages/ui/**",
    ".agents/**",
    ".claude/**",
    "tools/oxlint/anti-slop/**",
  ],
  jsPlugins: [
    // oxlint-disable-next-line typescript/no-non-null-assertion
    ...jsPlugins.jsPlugins!,
    // oxlint-disable-next-line typescript/no-non-null-assertion
    ...shadcn.jsPlugins!,
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
    {
      name: "anti-slop-effect",
      specifier: "./tools/oxlint/anti-slop/effect/index.ts",
    },
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
    "anti-slop-effect/no-manual-effect-error-tag": "error",
    "anti-slop-effect/no-manual-tag-comparison": "error",
    "anti-slop-effect/no-manual-tagged-construction": "error",
    "anti-slop-effect/no-service-constructor-imports": "error",
    "anti-slop-effect/prefer-effect-match": "error",
    "anti-slop/no-array-filter-map": "error",
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reduce-accumulator-copy": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    // Type predicates are the named boundary this rule pushes toward.
    "anti-slop/no-runtime-typeof": ["error", { allowInTypeGuards: true }],
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-readable-spacing": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",
    "func-style": ["error", "declaration"],
    "oxc/no-accumulating-spread": "error",
    "react/function-component-definition": [
      "error",
      {
        namedComponents: "function-declaration",
        unnamedComponents: "function-expression",
      },
    ],
    // These core rules conflict with anti-slop (fix/break loops).
    "typescript/consistent-indexed-object-style": "off",
    "unicorn/no-immediate-mutation": "off",
    "unicorn/prefer-reflect-apply": "off",
  },
});
