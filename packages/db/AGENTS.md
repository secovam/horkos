# packages/db

## Overview

Drizzle ORM schema and migrations for Cloudflare D1 (SQLite). Exposes `createDb(env)`, which wraps the Worker's `DB` binding.

## Key files

| File | Owns |
| --- | --- |
| `src/index.ts` | `createDb` and the `Database` type |
| `src/schema/` | Tables, one file per domain; `auth.ts` holds the Better Auth tables |
| `src/relations.ts` | Drizzle relations (v2 `defineRelations`) |
| `src/migrations/` | Generated SQL migrations |
| `drizzle.config.ts` | drizzle-kit config (sqlite dialect, `d1-http` driver) |

## Commands

- `pnpm db:generate` (from root): generate a migration after a schema change.

## Conventions

- Add a table in a file under `src/schema/` and re-export it from `src/schema/index.ts`.
- Other packages import tables by path, for example `@horkos/db/schema/auth`.

## Gotchas

- Alchemy applies `src/migrations/` to D1 on `pnpm deploy`; don't edit generated migration files.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
