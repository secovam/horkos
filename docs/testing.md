# Testing Horkos

Use Node 22.13 or newer in the Node 22 release line, or Node 24 (verified here), and the repository's pnpm version. Install dependencies and Chromium once:

```sh
pnpm install --frozen-lockfile
pnpm --filter web exec playwright install chromium
```

Run the logic tests and real browser flows from the repository root:

```sh
pnpm test
pnpm test:e2e
```

The unit suite uses `node:sqlite` and real migrations to check invitation validation, token handling and progress aggregates. The browser suite builds the actual web application for workerd, then gives each test a fresh local Miniflare Worker, migrated D1 database, loopback port and browser context. It seeds one fictional HR account; authentication uses the real login form and captured magic-link email. Invitations are created through the UI. Only the external `EMAIL.send` delivery boundary is replaced with local capture/failure control. No Cloudflare login, production secrets, `.alchemy` state or real employee data is needed.

For a targeted browser run, build first and filter the specs:

```sh
pnpm --filter web exec vite build --config vite-e2e.config.ts
pnpm --filter web exec playwright test auth.spec.ts
pnpm --filter web exec playwright test invitations.spec.ts --grep 'failed resend'
pnpm --filter web test -- invitation-metrics.test.ts
```

Avoid concurrent builds or Playwright invocations in one checkout: they share `dist` and the default result directory. The harness can coexist with the regular dev server because it owns separate ports and state. Fixtures dispose their Workers and remove temporary data even after failure.

Traces, screenshots and failure context stay under `apps/web/test-results/playwright/` after cleanup. Copy that directory before the next run replaces it. Open a trace with `pnpm --filter web exec playwright show-trace /absolute/path/to/trace.zip`. Traces contain usable fictional tokens; keep them local and redact links before sharing.

Current coverage includes HR login/logout, unknown-address denial, invitation create/cancel/duplicate/resend/revoke/reactivate, email failure recovery, anonymous mobile opening, scanner behavior, search privacy, pagination and dashboard counts. Contract download is covered by the confirm flow, which reads the filled AcroForm fields back from the downloaded PDF. The invitation guard is tested at its canonical `/invitaciones?tab=active&page=1` URL: bare `/invitaciones` returns a normalization redirect whose follow-up can hang in this local Worker harness, so that entry is an explicit coverage gap.

The [verification skill](../apps/web/.agents/skills/verify/SKILL.md) provides the maintained feature map and complete launch, doctor, evidence and cleanup recipe.
