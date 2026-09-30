# packages/infra

## Overview

Alchemy (v2 beta, on Effect) stack that defines the Cloudflare resources: a D1 database and the `web` Worker built from `apps/web`.

## Key files

| File | Owns |
| --- | --- |
| `alchemy.run.ts` | Resources and the Worker bindings (`DB`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`) |
| `.env.schema` | Deploy secrets such as `ALCHEMY_PASSWORD` |

## Commands

- `pnpm dev` (root): runs `alchemy dev` behind portless at https://horkos.localhost (worktrees get a prefix; `PORTLESS=0 pnpm dev` bypasses). It starts the web app with its bindings; `PORT` and `PORTLESS_URL` (set by portless) feed the dev port and `BETTER_AUTH_URL`.
- `pnpm deploy` / `pnpm destroy` (root): interactive.
- `pnpm exec alchemy profile edit` (here): set up provider accounts.
- `pnpm exec alchemy deploy --stage production` (here): production deploy.

## CI previews

`.github/workflows/preview.yml` gives each same-repo pull request its own stack: `alchemy deploy --stage pr-<n>` on open/reopen/push, `alchemy destroy --stage pr-<n>` on close or merge (serialized per PR). Previews only; there is no production job. Each preview gets a fresh, empty D1 database.

- Preview secrets are loaded from the `Horkos Preview` 1Password vault by `1password/load-secrets-action`. Create an item named `Preview Deployment` with fields `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ALCHEMY_PASSWORD`, and `BETTER_AUTH_SECRET`; `.env` references live in `preview-secrets.env.tpl` and are shared with local `op run` use. GitHub Actions needs only the `OP_SERVICE_ACCOUNT_TOKEN` repository secret, scoped read-only to this vault. A guard step fails if any loaded value is empty, because `.env.schema` has fake dev defaults that would otherwise apply silently.
- Keep `ALCHEMY_PASSWORD` stable and identical for deploy and destroy (state encryption).
- Same-repository pull requests can access this workflow's secrets. Only enable preview deployments for branches you trust; fork PRs are skipped.
- Previews post a sticky PR comment with the Worker URL (`GitHub.Comment`, gated on `GitHub.GitHubEnv`, updated in place on each push). It needs `pull-requests: write` and the built-in `GITHUB_TOKEN`; no extra secret. The workflow exports `PULL_REQUEST` for deploy and destroy alike, so destroy also removes the comment.
- Fork PRs are skipped; they get no secrets.

## Conventions

- A new Worker env var goes in two places: `apps/web/.env.schema` and the `env` block in `alchemy.run.ts`.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
