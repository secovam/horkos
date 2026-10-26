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
| `src/worker.ts` | Worker entry (`main` in `alchemy.run.ts`): `fetch` wrapped in evlog request logs (user tagged, invitation tokens redacted) plus the `scheduled` cron and `queue` consumer from `src/worker-handlers.ts` |
| `src/services/invitation-queue.ts` | Enqueues unsent invitations and emails them from the queue, one at a time |
| `src/lib/extraction.ts` | Parsers from document text to form fields, one per `DocumentKind` (`parseDocument`); drops values the form would reject |
| `src/lib/contract.ts` | Record to contract: words each value for the template (`contractFields`) and fills the AcroForm fields of `src/templates/contract.pdf` (`fillContract`) |
| `src/services/extractor.ts` | Sends a PDF to the `EXTRACTOR` container for its text; a container failure becomes status `failed`, never a failed upload |
| `scripts/seed-employees.ts` | `pnpm seed:employees <csv>`: HR list to `packages/db/seed/employees.sql` |

## Commands

- `pnpm turbo run check-types -F web`: runs `vite build`, then `tsc`.

## Conventions

- Import app code with `@/` (maps to `src/`).
- Server logic lives in `createServerFn` handlers under `src/functions/`; protect them with `authMiddleware`.
- Get db and auth through `src/services.ts`, never by calling the package factories directly.
- Protected pages go under `src/routes/_auth/`.
- Forms use `@tanstack/react-form` with Zod schemas; toasts use `toast` from `@horkos/ui/components/toast` (goey-toast).

## Gotchas

- Server env comes from Worker bindings (`cloudflare:workers`), not `process.env`. Bindings are declared in `packages/infra/alchemy.run.ts`.
- There is no Nitro: Alchemy builds the Worker from `src/worker.ts`, so request-level hooks go there, not in a Nitro plugin.
- `cloudflare:workers` is marked external in the Vite build; it only resolves inside workerd.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
