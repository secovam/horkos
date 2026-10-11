---
name: verify
description: Drive Horkos's real web UI in disposable local Workers to verify HR magic-link login, dashboard counts, invitation lifecycle and employee links. Use after behavior changes or when collecting browser evidence.
---

# Verify Horkos

Read [the feature map](features/README.md), then its relevant recipe. Commands run from the repository root. Use fictional data only. This harness never starts Alchemy, accesses `.alchemy`, sends real email, or touches production resources.

## Launch

Install dependencies with `pnpm install --frozen-lockfile`. The runtime requires Node 22.13 or newer (the unit suite uses `node:sqlite`), pnpm, and Chromium:

```sh
pnpm --filter web exec playwright install chromium
pnpm --filter web exec vite build --config vite-e2e.config.ts
```

This builds the actual application for workerd. The test build uses Worker resolution conditions and includes dependencies; plain Vite's Node SSR output contains CommonJS loading that workerd cannot resolve. Application source and server handlers are unchanged.

The Drive command starts a fresh Miniflare/workerd instance for each test on an ephemeral loopback port, applies every existing D1 migration, seeds only `Verification HR <verification-hr@example.com>`, and creates an isolated browser context. It captures `EMAIL.send` at the existing external email boundary in local KV; application handlers, auth and D1 are real. No sessions or invitation rows are injected. Instances can coexist with the user's dev server because they have separate ports, databases, mail and browser contexts. Avoid concurrent builds or Playwright commands in the same checkout because `dist` and default evidence paths are shared.

For a complete verification run, use `pnpm test` and `pnpm test:e2e`. For one feature, build once above and use its scoped Drive command below.

## Doctor

Before driving, perform this read-only harness check:

```sh
pnpm --filter web exec playwright test --list
```

Require the expected feature tests to be listed. A parse error, missing browser or missing build is a setup failure, not a product verdict. Each test's fixture also checks the owned listener's `/login` response before interacting: status 200 and the real Horkos form. Miniflare readiness means the Worker and bindings initialized; the successful login then proves the genuine auth/D1 path.

If a run fails, inspect its trace and error context before rerunning only the failing case. Do not drive another dev process, reuse the user's cookies, or reset their database. After source changes, rebuild before replaying.

## Drive

For the login feature:

```sh
pnpm --filter web exec playwright test auth.spec.ts
```

Other concrete recipes and selectors live in the feature map. Playwright uses labels and ARIA roles, drives the real form, reads the newly captured fictional email, opens its magic link, and observes the dashboard. No DOM setters, injected cookies or test-only HTTP endpoints. Tests use the built-in browser/page fixtures; employee coverage creates an independent anonymous context with a 1280 × 900 viewport (390 × 844 touch for the phone notice).

The fixture seeds an HR account because the app has no sign-up route. Other setup uses the UI. Read-only D1 assertions inspect only that test's fictional rows to corroborate persistence, first-open timestamps, denied writes and session removal. Failure tests deliberately reject delivery at `EMAIL.send`, then observe the existing app's recovery behavior.

## Evidence

Playwright keeps action history, request/response evidence, DOM snapshots and screenshots under `apps/web/test-results/playwright/`. Each test records `trace.zip` and a final screenshot; employee proof also saves `employee.png`. Failure cases produce `error-context.md`. Evidence survives runtime disposal.

Preserve a run before another Playwright command clears its default output:

```sh
VERIFY_EVIDENCE=$(mktemp -d "${TMPDIR:-/tmp}/horkos-proof.XXXXXX")
cp -R apps/web/test-results/playwright "$VERIFY_EVIDENCE/playwright"
git rev-parse HEAD > "$VERIFY_EVIDENCE/revision.txt"
```

Record the tested feature IDs, command, revision, result and any skips in `$VERIFY_EVIDENCE/proof.md`. A useful proof captures the action and resulting visible state plus the relevant mail/database side effect. The captured mail proves simulated delivery only. Traces include usable fictional login/invitation tokens; keep them local and redact token URLs when sharing excerpts. Never point this harness at real employee data.

Inspect a trace with `pnpm --filter web exec playwright show-trace` followed by its absolute `trace.zip` path. Unit tests corroborate schema normalization and actual migrated SQL aggregates; they do not replace browser flow proof.

## Cleanup

Fixtures dispose only their own Miniflare instance and remove its `horkos-e2e-*` temporary directory in `finally`, including failed setup. Playwright closes its own browser contexts. Normal command completion leaves no listener or fixture database. Evidence stays at the path above. On interruption, send Ctrl-C through the exact exec/PTY session you launched; never kill by process name or touch `.alchemy`.

Confirm preserved `trace.zip` and screenshots still exist after teardown. If the process was force-killed before cleanup, inspect only the recorded process/temp directory from your own run before removing it; never delete a glob of other agents' instances. Neither cleanup nor the skill asks for deployment or remote credentials.

## Helpers

- `tests/e2e/runtime.ts` owns the disposable Worker, real migrations and mail boundary.
- `tests/e2e/fixtures.ts` owns readiness and teardown, invoked by every Playwright recipe.
- `tests/e2e/actions.ts` supplies real login, invitation form and confirmation actions.
- `playwright.config.ts` configures browser evidence; `vite-e2e.config.ts` builds the Worker-compatible artifact.

All helpers run through the commands above; no separate daemon or helper installation is required. Use `pstack:maintain-verification-skill` when app routes or selectors change.
