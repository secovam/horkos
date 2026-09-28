# Monorepo

## Dependencies

- Versions shared across packages live in the pnpm `catalog`; reference them as `"catalog:"`.
- Internal packages: `"workspace:*"`.
- Run a task in one package: `pnpm turbo run <task> -F <package-name>`.

## Environment

- Each app/package keeps its env schema in `.env.schema`. Varlock generates `src/env.ts` only for `apps/web` and `packages/db` (`pnpm env:generate`).
- Bun's automatic `.env` loading is disabled in `bunfig.toml`; Varlock loads env.
- Commit schemas; secrets stay in ignored env files or the deploy platform.

## Commands

- `pnpm dev`: all dev tasks via Turbo. `pnpm dev:web`: web only (Vite).
- `pnpm db:generate`: generate Drizzle migrations.
- `pnpm deploy` / `pnpm destroy`: Alchemy (interactive).
