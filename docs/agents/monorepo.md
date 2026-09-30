# Monorepo

## Dependencies

- Versions shared across packages live in the pnpm `catalog`; reference them as `"catalog:"`.
- Internal packages: `"workspace:*"`.
- Run a task in one package: `pnpm turbo run <task> -F <package-name>`.

## Environment

- Root `.env.schema` is the single source for every env var, with dev-only defaults (alchemy sees `NODE_ENV=production`, so no `forEnv` gating; deploys override secrets with real env vars). Add new vars there.
- Apps/packages keep a `.env.schema` that only imports what they need: `# @import(../../, pick=[...])`. Varlock generates `src/env.ts` only for `apps/web` and `packages/db` (`pnpm env:generate`).
- Bun's automatic `.env` loading is disabled in `bunfig.toml`; Varlock loads env.
- Commit schemas; secrets stay in ignored env files or the deploy platform.

## Commands

- `pnpm dev`: `alchemy dev` behind portless at https://horkos.localhost (worktrees get a prefix; `PORTLESS=0 pnpm dev` bypasses).
- `pnpm db:generate`: generate Drizzle migrations.
- `pnpm deploy` / `pnpm destroy`: Alchemy (interactive).
