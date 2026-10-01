# Employee invitation link

An employee opens the emailed link without an account and sees whether it is valid. The current page records opening; it does not collect documents or employee details yet.

## Sub-features

- `employee-valid` accepts the emailed link without HR login.
- `employee-open` records the first hydrated visit once.
- `employee-invalid` hides unknown, revoked, and replaced links behind the same message.
- `employee-mobile` remains readable on a phone viewport.

## How to get to it (user POV)

- Open the invitation link from the original email.
- Open a replacement link after HR resends.
- Revisit an original, invalid, or revoked `/invitacion/<token>` link.

## Driving it with T3 preview

Preconditions: invitation created through the UI and its link read from the run's local email capture. Use a separate owned browser tab without authenticating as HR.

- **Scanner behavior.** Fetch the fictional invitation URL with curl before browser navigation. Query only its recorded row's `opened_at` read-only; HTML fetching must leave it null.
- **Valid visit.** `preview_navigate` to the actual captured link, then `preview_wait_for({tabId,text:"Tu invitación fue recibida"})`. Wait until the fixture's `opened_at` becomes non-null. Reload and require the same timestamp.
- **Invalid visit.** Navigate to `http://localhost:3101/invitacion/not-a-valid-token`; require `Este enlace no está disponible`. Repeat with the old link after resend and the current link after revocation; all must show the same unavailable state.
- **Mobile.** `preview_resize({tabId,mode:"preset",preset:"iphone-12-pro",orientation:"portrait"})`; revisit the valid fictional link and require readable status without horizontal overflow. Save a screenshot with the URL redacted.

## Gotchas

- Opening is recorded after browser hydration. HTML alone is insufficient proof of tracking.
- Resending replaces the token, so keep old and new URLs locally until testing invalidation.
- Tokens are access credentials. Do not put raw links into logs, committed files, screenshots with browser URLs, or shared reports.
- No upload, extraction, review, or download controls exist here yet.
