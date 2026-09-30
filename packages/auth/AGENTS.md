# packages/auth

## Overview

Better Auth setup. `createAuth(env, db, sendMagicLink)` builds the auth instance on top of the Drizzle adapter; the app calls it through `apps/web/src/services.ts`.

## Key files

| File           | Owns                                               |
| -------------- | -------------------------------------------------- |
| `src/index.ts` | `createAuth`, `AuthConfig`, and the `Session` type |

## Conventions

- Only existing users can request a magic link. Password sign-in and self-registration are disabled.
- Provision HR accounts out of band; the app does not expose account creation.
- Magic-link email delivery is injected by the app; do not couple this package to Cloudflare or email rendering.
- Auth tables live in `packages/db/src/schema/auth.ts`, not here.
- Keep `tanstackStartCookies()` as the last plugin in the `plugins` list.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
