# Invitation browsing

HR finds invitations by employee name or email, switches between active and revoked records, and pages through results.

## Sub-features

- `list-tabs` separates active and revoked invitations.
- `list-search` filters by name/email and clears correctly.
- `list-empty` distinguishes no invitations from no search matches.
- `list-pages` shows ten rows per page with previous/next controls.

## How to get to it (user POV)

- Choose sidebar `Invitaciones`.
- Open `/invitaciones` directly while logged in.
- Choose tabs `Activas` and `Revocadas`, search, or use `Paginación` controls.

## Driving it with T3 preview

Preconditions: logged-in fictional HR. Create fixture invitations through the management recipe. Pagination requires at least eleven matching fictional invitations; otherwise report that sub-feature skipped. Do not screenshot unrelated employees.

- **Reach list.** Navigate to `/invitaciones`, inspect the table headings `Empleado`, `Correo`, `Estado`, and `Último envío`.
- **Search.** `preview_type({tabId,locator:"role=searchbox[name='Filtrar por nombre o correo']",text:"Verification Employee",clear:true})`; wait for the run's row. Repeat using its resolved email, then a unique nonexistent value. Require `Ninguna invitación coincide con la búsqueda.`. Clear the field and require rows return.
- **Tabs.** Click `role=tab[name='Revocadas']` and require the revoked fixture row; click `role=tab[name='Activas']` and require active rows. Revoked rows must have no `Reenviar:` or `Revocar:` actions.
- **Pages.** For eleven matching fixtures, click `role=button[name='Siguiente']` and require a different set of rows; click `role=button[name='Anterior']` and require the original page. First/last page controls disable at their boundaries.
- **Proof.** Reload the page, filter again, and capture only fictional rows. Require that name/email search text never appears in the URL. In an empty isolated checkout, require `Aún no hay invitaciones aquí.` with no filter.

## Gotchas

- Search debounces for 300 ms; wait for the result rather than taking an immediate snapshot.
- Filter text is local state and does not survive reload. Requests use POST to keep personal data out of URLs.
- Page size is ten. A one-row fixture does not prove pagination or global search.
