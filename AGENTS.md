# Horkos

Horkos is an internal tool for collecting employee information and turning it into employment contracts. HR invites each employee by email with a unique link; the employee uploads their documents (proof of address, _constancia de situación fiscal_, IMSS certificate) and fills in what they know. Horkos extracts the data from those documents, HR reviews it and completes the rest, and Horkos fills a PDF template's AcroForm fields to produce a contract ready to print. Signing happens on paper, outside Horkos.

## What we never compromise on

### 1. Employee data stays private

Horkos handles sensitive personal data: RFC, CURP, NSS, home addresses, tax and social security documents. Documents live in a private R2 bucket, kept indefinitely. Nothing sensitive goes to logs, error messages, analytics, URLs, or fixtures.

### 2. HR always validates

Extraction proposes; a person confirms. No contract is generated from extracted data HR has not reviewed.

### 3. The employee link is effortless

Employees have no account. The invitation link is the whole experience: it works on a phone, needs no sign-up, and can be finished in one sitting.

### 4. The PDF is exact

The generated contract must match the template exactly and print correctly. Data is written into the template's AcroForm fields, never drawn on top of the page.

## A small glossary

- **you** means the agent reading this file and changing Horkos.
- **HR / admin** means a user with an account (Better Auth) who sends invitations, completes data, and downloads contracts.
- **employee** means the person being invited. They have no account and enter only through their invitation link.
- **invitation** means the unique link emailed to one employee. Invitations never expire; HR revokes them instead.
- **submission** means what the employee sends: documents plus the data they filled in themselves.
- **document** means an uploaded file: proof of address, _constancia de situación fiscal_, IMSS certificate.
- **extraction** means the data Horkos pulls out of a document.
- **template** means the PDF with AcroForm fields that contracts are generated from.
- **contract** means the filled PDF produced from the template for one employee.

## The four ways to hurt yourself

1. **Touching remote resources.** Never run `pnpm deploy` or `pnpm destroy`, and never read or write the production D1 database or R2 bucket, unless explicitly asked. Work locally.
2. **Leaking personal data.** Never log, commit, or paste real employee data or documents. Test data is fictional: made-up names, RFCs, CURPs, NSS numbers, and sample documents.
3. **Exposing R2.** No public buckets and no public or long-lived object URLs. Documents are served only through authenticated server functions or scoped to the owning invitation.
4. **Hand-editing generated files.** Never edit `src/env.ts` (change `.env.schema`, then `pnpm env:generate`) or a migration that has already been applied (generate a new one with `pnpm db:generate`).

## Hit every surface

- **Both sides.** Most features touch the HR dashboard and the employee invitation flow. Decide for each.
- **Reverse states.** If you added a way in, add the way out: an invitation that can be sent can be resent and revoked; data HR confirms can be corrected.
- **Extraction failures.** Unreadable, wrong, or missing documents are normal. HR must be able to see and fix what extraction got wrong.
- **Template fields.** A new data field needs a decision about where it lands in the template.

## Stack and commands

TypeScript monorepo: TanStack Start web app plus shared packages, deployed to Cloudflare via Alchemy, orchestrated by Turborepo. Data and auth: Cloudflare D1 through Drizzle, Better Auth (email and password), documents in R2.

- Package manager: **pnpm** (never `npm`/`yarn`/`bun install`). Bun is only a runtime.
- `pnpm dev` runs everything.
- Lint + format: `pnpm fix` (Ultracite = Oxlint + Oxfmt). Lefthook runs it on pre-commit.
- Typecheck: `pnpm check-types` (slow: `web` runs `vite build` first).

## Verifying

- Smallest proof that the change works: `pnpm fix`, then typecheck the package you touched.
- Prefer end-to-end tests with Playwright that drive the real flows (invite, upload, review, download) over unit tests. Unit-test only real logic such as extraction parsing and data-to-AcroForm mapping.
- Do not write tests that mirror the implementation or only assert wiring.

## Pull requests

- Never open a PR unless asked.
- Titles follow the repo's commit style. Keep the body empty.
- One concern per PR. UI changes need before/after screenshots.

## Plans and work artifacts

Do not commit implementation plans, research notes, or scratch files.

## Where code lives

- `apps/web` - TanStack Start app: routes, server functions, env bindings. See [apps/web/AGENTS.md](apps/web/AGENTS.md).
- `packages/db` - Drizzle schema and D1 migrations. See [packages/db/AGENTS.md](packages/db/AGENTS.md).
- `packages/auth` - Better Auth setup. See [packages/auth/AGENTS.md](packages/auth/AGENTS.md).
- `packages/ui` - shadcn components on Base UI. See [packages/ui/AGENTS.md](packages/ui/AGENTS.md).
- `packages/infra` - Alchemy stack for Cloudflare. See [packages/infra/AGENTS.md](packages/infra/AGENTS.md).

Read when relevant: [monorepo dependencies, env, DB, deploy](docs/agents/monorepo.md), [TypeScript conventions](docs/agents/typescript.md), [React and UI](docs/agents/react.md).

## Taste

- Complexity belongs at the edges: extraction and PDF generation. Routes and UI stay dumb.
- Code, comments, and docs are in English. The UI is in Spanish.
- `@horkos/ui` components own their look. Pick a `variant` or `size`; do not restyle them with `className`. Layout classes belong on the parent.
- Inferred types over annotations. `any` is the enemy.
- If a rule here fights the task in front of you, say so and get sign-off before breaking it.
