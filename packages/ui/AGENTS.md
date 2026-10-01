# packages/ui

## Overview

Shared shadcn components built on Base UI (`@base-ui/react`, style `base-nova`), not Radix. Apps import them as `@horkos/ui/components/<name>`.

## Key files

| File | Owns |
|---|---|
| `src/components/` | shadcn components |
| `src/lib/utils.ts` | `cn` helper |
| `src/styles/globals.css` | Tailwind v4 theme and global styles |

## Conventions

- Add components with the shadcn CLI from `apps/web`; its `components.json` routes them into this package.
- This package is excluded from lint, so keep components as the CLI generates them.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
