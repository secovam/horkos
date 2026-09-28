# apps/web

## Overview

TanStack Start app (React 19, TanStack Router, Query, Form) built with Vite and deployed as a Cloudflare Worker by `packages/infra`. It holds every route, the server functions, and the Better Auth HTTP handler.

## Key files

| File | Owns |
| --- | --- |
| `src/routes/` | File based routes. `src/routeTree.gen.ts` is generated, never edit it |
| `src/routes/_auth/route.tsx` | Guard layout, redirects to `/login` when there is no session |
| `src/routes/api/auth/$.ts` | Better Auth HTTP handler |
| `src/services.ts` | `getDb()` and `createAuth()`, the one place that builds db and auth |
| `src/env.server.ts` | Server env, read from `cloudflare:workers` bindings |
| `src/middleware/auth.ts` | Puts `session` on the server function context |
| `server/plugins/evlog-auth.ts` | Nitro plugin that tags evlog request logs with the user |

## Commands

- `pnpm dev:web`: plain Vite dev server on port 3001. Use root `pnpm dev` when you need D1 and auth bindings.
- `pnpm turbo run check-types -F web`: runs `vite build`, then `tsc`.

## Conventions

- Import app code with `@/` (maps to `src/`).
- Server logic lives in `createServerFn` handlers under `src/functions/`; protect them with `authMiddleware`.
- Get db and auth through `src/services.ts`, never by calling the package factories directly.
- Protected pages go under `src/routes/_auth/`.
- Forms use `@tanstack/react-form` with Zod schemas; toasts use `sonner`.

## Gotchas

- Server env comes from Worker bindings (`cloudflare:workers`), not `process.env`. Bindings are declared in `packages/infra/alchemy.run.ts`.
- `cloudflare:workers` is marked external in the Vite build; it only resolves inside workerd.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
