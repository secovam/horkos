# TypeScript conventions

Ultracite lint enforces most style. These are the rules that need judgment.

- Named functions are `function` declarations (`func-style: declaration`). Arrows only for inline callbacks. Exception: routes and components folders.
- Prefer `unknown` over `any`; narrow instead of asserting with `as`.
- Use `as const` for immutable literal values.
- No barrel files. Exception: package entrypoints (`packages/*/src/index.ts`, `packages/db/src/schema/index.ts`).
- Extract complex conditions into well-named booleans; no nested ternaries.
- Only `try/catch` when you handle the error; don't catch just to rethrow.
