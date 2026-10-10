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

## Loading real employees

Invitations have three send states: queued (`sent_at` null, `enqueued_at` null), enqueued (`enqueued_at` set: the Cloudflare Queue owns the row until it confirms the email went out, even if `sent_at` is already set) and sent (`token_hash` and `sent_at` set, `enqueued_at` null). A CHECK keeps `token_hash` and `sent_at` null or set together. A cron on the `web` Worker moves up to 100 queued rows per minute onto the queue, plus rows enqueued over an hour ago whose message was lost, and a throttled consumer emails them. Sending from the dashboard clears `enqueued_at`, so a pending message for that row does nothing.

1. Save HR's list as `nombre,correo` CSV anywhere outside the repo, or in `seed/` (git ignores `seed/*.csv` except the example).
2. `pnpm seed:employees path/to/list.csv` validates it with the dashboard's rules and writes `seed/employees.sql` (git ignored). Invalid lines are listed by number and nothing is written; repeated emails keep the first. Re-running is safe: inserts use `ON CONFLICT(email) DO NOTHING`.
3. `pnpm dev` loads `seed/employees.sql` into the local D1 when the file exists.
4. Production, only when asked: deploy first so the migration, queue and cron exist, read `databaseName` from the deploy output (also under Storage & Databases > D1 in the Cloudflare dashboard), then `pnpm dlx wrangler d1 execute <databaseName> --remote --file packages/db/seed/employees.sql`. Emails start going out within a minute.
5. HR can send one immediately with "Reenviar" in the dashboard, which also recovers an invitation whose queue retries ran out.

## Conventions

- Add a table in a file under `src/schema/` and re-export it from `src/schema/index.ts`.
- Other packages import tables by path, for example `@horkos/db/schema/auth`.

## Gotchas

- Alchemy applies `src/migrations/` to D1 on `pnpm deploy`; don't edit generated migration files.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
