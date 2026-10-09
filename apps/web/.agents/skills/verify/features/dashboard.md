# Dashboard

HR sees progress counts for active invitations and navigates to the invitation list.

## Sub-features

- `dashboard-counts` shows five loaded counts.
- `dashboard-open` reflects an employee opening a link.
- `dashboard-revoke` excludes revoked invitations.
- `dashboard-navigation` reaches the list and returns home.

## How to get to it (user POV)

- Finish magic-link login, which lands at `/dashboard`.
- Open `/dashboard` directly while logged in.
- Choose the sidebar `Inicio` or `Horkos` link, or the `Inicio` breadcrumb on the invitation list.

## Driving it with T3 preview

Preconditions: logged-in fictional HR. Use invitation management to create a run-owned invitation; record baseline counts first.

- **Counts.** Navigate to `/dashboard` and wait until all five metric cards show numbers rather than `–`. Snapshot labels `Invitaciones enviadas`, `Invitaciones abiertas`, `Empleados que terminaron de llenar su información`, `Empleados pendientes de información de RH`, and `Contratos pendientes de generar`.
- **Open.** Drive the employee-link recipe in another owned tab, then revisit `/dashboard`. Sent/opened counts must change by the run's expected delta. Compare with read-only local aggregate counts filtered to `revoked_at IS NULL` and the run's invitation timestamps.
- **Revoke.** Revoke that invitation through the list and revisit `/dashboard`; its contribution to sent/opened counts must disappear.
- **Navigation.** Click `role=link[name='Invitaciones']`; require `/invitaciones`. Return with a sidebar `Inicio`, `Horkos`, or breadcrumb `Inicio` link, scoped using the snapshot if multiple `Inicio` links match. Record each entry exercised.

## Gotchas

- Cached query data can survive navigation. Reload before concluding counts are stale.
- Submitted/HR/contract metric labels do not imply those user flows exist. Do not set their database timestamps just to manufacture UI proof.
- Existing local invitations may affect totals. Compare deltas without inspecting their personal data.
