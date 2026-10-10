# Dashboard

HR sees progress counts for active invitations.

## Sub-features

- `dashboard-counts`: sent/opened counts follow real employee visits.
- `dashboard-revoke`: revoked invitations disappear from all progress counts.
- `dashboard-navigation`: sidebar and breadcrumb reach list/home.
- `dashboard-stage-edges`: SQL logic returns zero on empty/all-revoked data.

## How to get to it (user POV)

Login lands on `/dashboard`. Choose `Inicio` in the sidebar or invitation breadcrumb; authenticated direct navigation also reaches dashboard.

## Driving it with Playwright

```sh
pnpm --filter web exec playwright test invitations.spec.ts --grep 'dashboard counts'
pnpm --filter web test -- invitation-metrics.test.ts
```

The browser recipe creates an invitation through the list, opens its captured link anonymously, observes sent/opened cards at one, revokes through the UI, reloads dashboard and requires both at zero. SQL tests apply actual migrations and independently check every metric stage plus empty and all-revoked databases.

## Gotchas

Query cache may retain previous counts; reload for the persistence verdict. The submitted/HR/contract labels are future flows; do not seed stage timestamps to pretend those UI flows exist. SQL stage fixtures are fictional aggregate logic tests only.
