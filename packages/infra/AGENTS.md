# packages/infra

## Overview

Alchemy (v2 beta, on Effect) stack that defines the Cloudflare resources: a D1 database and the `web` Worker built from `apps/web`.

## Key files

| File | Owns |
| --- | --- |
| `alchemy.run.ts` | Resources and the Worker bindings (`DB`, `EMAIL`, `EMAIL_FROM`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`) |
| `.env.schema` | Deploy secrets such as `ALCHEMY_PASSWORD` |

## Commands

- `pnpm dev` (root): runs `alchemy dev` behind portless at https://horkos.localhost (worktrees get a prefix; `PORTLESS=0 pnpm dev` bypasses). It starts the web app with its bindings; `PORT` and `PORTLESS_URL` (set by portless) feed the dev port and `BETTER_AUTH_URL`.
- `pnpm deploy` / `pnpm destroy` (root): interactive.
- `pnpm exec alchemy profile edit` (here): set up provider accounts.
- `pnpm exec alchemy deploy --stage production` (here): production deploy.

## Conventions

- A new Worker env var goes in two places: `apps/web/.env.schema` and the `env` block in `alchemy.run.ts`.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
