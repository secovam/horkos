# Employee invitation link

Employees open an emailed link without an account. The current page records opening and displays status; collection controls are not implemented yet.

## Sub-features

- `employee-scanner`: HTML GET does not mark the invitation opened.
- `employee-first-open`: hydration marks the first visit and later visits preserve its timestamp.
- `employee-mobile`: anonymous 390 × 844 context sees valid and invalid status.
- `employee-referrer`: token page uses `no-referrer`.
- `employee-lifecycle`: old, revoked and replaced links stay unavailable, including after reactivation.

## How to get to it (user POV)

Open the original emailed link, a resend/reactivation email, or a previously used link. No account or HR session is needed.

## Driving it with Playwright

```sh
pnpm --filter web exec playwright test invitations.spec.ts --grep 'scanner GET|resend invalidates|failed resend'
```

The scanner test obtains a real UI-created invitation, fetches its HTML, and checks `opened_at` remains null. It opens the email link in an independent anonymous mobile context, requires `Tu invitación fue recibida`, waits for the database timestamp, reloads and waits for the hydration POST before checking the same timestamp. It verifies the referrer meta tag and saves `mobile-employee.png`. An unknown link requires `Este enlace no está disponible`; dashboard remains protected in the employee context. Lifecycle recipes check original/replaced/revoked/reactivated links individually.

## Gotchas

HTML alone does not prove hydration tracking. Keep old URLs locally until the replacement check finishes. Traces contain fictional tokens; redact them before sharing. Screenshots capture page content without the browser URL bar. No upload, extraction, HR review or contract download is covered.
