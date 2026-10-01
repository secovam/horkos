# Horkos verification map

Read this index before driving the local app. Baseline is the owned Alchemy instance at `http://localhost:3101`, a fresh browser tab, and fictional per-run fixtures from [verify](../SKILL.md). Never double-drive a checkout's shared `.alchemy` state.

## Features

- [HR login](login.md) covers protected-route redirects, validation, magic links, unknown addresses, and logout.
- [Dashboard](dashboard.md) covers active-invitation progress counts and navigation.
- [Invitation browsing](invitation-list.md) covers tabs, search, empty states, and pagination.
- [Invitation management](invitation-management.md) covers create, cancel, duplicate, resend, and revoke.
- [Employee link](employee-link.md) covers valid, invalid, rotated, and revoked links plus open tracking.

## Driving conventions

All recipes use T3 preview calls with the owned `tabId`; inspect snapshots before interacting. Wait on visible state rather than fixed delays. Start each recipe from its stated preconditions. Capture the action and resulting state, then check only the run's fixture side effects with local read-only SQLite or email capture. Record which sub-features and entry points were exercised and which were skipped. Keep proof outside the checkout after cleanup.

Uploads, extraction, HR completion, and contract downloads are described in product docs but have no implemented user path yet. Do not invent recipes for them. Refresh this map when those routes ship.
