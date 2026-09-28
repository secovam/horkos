# packages/auth

## Overview

Better Auth setup. `createAuth(env, db)` builds the auth instance on top of the Drizzle adapter; the app calls it through `apps/web/src/services.ts`.

## Key files

| File           | Owns                                               |
| -------------- | -------------------------------------------------- |
| `src/index.ts` | `createAuth`, `AuthConfig`, and the `Session` type |

## Conventions

- Only email and password sign in is enabled.
- Auth tables live in `packages/db/src/schema/auth.ts`, not here.
- Keep `tanstackStartCookies()` as the last plugin in the `plugins` list.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
