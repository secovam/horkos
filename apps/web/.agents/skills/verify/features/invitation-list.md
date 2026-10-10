# Invitation browsing

HR finds invitations by name/email, switches status tabs and pages through results.

## Sub-features

- `list-search`: `%` and `_` match literally, without exposing terms in URLs.
- `list-tabs`: filtered counts distinguish active and revoked rows.
- `list-pages`: ten rows per page, boundary buttons, search resets page.
- `list-empty`: empty and no-match states are separate manual entries.

## How to get to it (user POV)

Choose sidebar `Invitaciones`, then `Activas`/`Revocadas`, `Filtrar por nombre o correo`, or `Anterior`/`Siguiente`. HR can also navigate directly to `/invitaciones`.

## Driving it with Playwright

```sh
pnpm --filter web exec playwright test invitations.spec.ts --grep 'literal wildcard|pagination'
```

The literal-search test creates two similarly named employees through the UI, searches `50%_`, requires only the literal match and checks all request URLs for absence of the term/email. It revokes the match and checks filtered tab counts. Pagination creates eleven fictional invitations through the UI, checks ten then one data row, and verifies searching from page two returns to page one without the email in the URL.

## Gotchas

Search debounces; wait for the resulting row set. It lives in component state and resets on reload. Both header and empty-state render `Nueva invitación`; the harness selects the header trigger. When changing empty states, exercise the separate empty-state trigger too and record it as an additional entry.
