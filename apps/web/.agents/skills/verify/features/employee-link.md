# Employee invitation link

Employees open an emailed link without an account. The page records opening, shows the submission form while the invitation is open, and shows a confirmation once it was submitted. Extraction, HR review and contract download are not implemented.

## Sub-features

- `employee-scanner`: HTML GET does not mark the invitation opened.
- `employee-first-open`: hydration marks the first visit and later visits preserve its timestamp.
- `employee-phone-notice`: a touch-primary device (phone or tablet, 390 × 844 with `isMobile` and `hasTouch`) sees `Abre este enlace en una computadora` instead of the form, and the first opening is still recorded.
- `employee-referrer`: token page uses `no-referrer`.
- `employee-submit`: the form asks for 3 documents (constancia fiscal, IMSS, comprobante de domicilio; PDF only, up to 10 MB), nombre completo (prefilled), RFC, CURP, NSS and the address. Submitting stores one `submission` row, three `document` rows, objects in R2 under `invitations/{id}/employee/{kind}` and sets `submitted_at` (HR sees "Recibida"). Reloading shows "Recibimos tu información".
- `employee-file-validation`: file type is checked on the server by magic bytes, so a text file renamed `.pdf` or a PNG image is rejected with an inline error above the submit button and nothing is stored.
- `employee-tour`: the first open of an open invitation starts a 5 step driver.js tour (welcome, Documentos, Datos personales, Domicilio, Enviar) after hydration. It closes with the X, Esc, an overlay tap or "Listo", and `localStorage` key `horkos:submission-tour:v1` (no token) stops it reappearing. "¿Cómo lleno esto?" replays it. Dismiss it first (button "Cerrar guía") before driving the form, since it blocks clicks.
- `employee-revoked-submit`: a form opened before HR revoked the link cannot submit.
- `employee-lifecycle`: old, revoked and replaced links stay unavailable, including after reactivation.

## How to get to it (user POV)

Open the original emailed link, a resend/reactivation email, or a previously used link. No account or HR session is needed.

## Driving it with Playwright

```sh
pnpm --filter web exec playwright test invitations.spec.ts --grep 'scanner GET|resend invalidates|failed resend'
pnpm --filter web test:e2e submission.spec.ts
```

The scanner test obtains a real UI-created invitation, fetches its HTML, and checks `opened_at` remains null. It opens the email link in an independent anonymous desktop context (1280 × 900), requires the form heading `Completa tu información`, waits for the database timestamp, reloads and waits for the hydration POST before checking the same timestamp. It verifies the referrer meta tag and saves `employee.png`. An unknown link requires `Este enlace no está disponible`; dashboard remains protected in the employee context. A separate test opens the link in a phone context and requires the computer notice, no form fields and a recorded `opened_at`. `submission.spec.ts` drives the full form in a 1280 × 900 desktop context with generated fixture files (fictional data only), inspects D1 and the Miniflare R2 bucket, and saves `form-filled.png` and `submitted.png`. Lifecycle recipes check original/replaced/revoked/reactivated links individually.

## Gotchas

HTML alone does not prove hydration tracking. Keep old URLs locally until the replacement check finishes. Traces contain fictional tokens; redact them before sharing. Screenshots capture page content without the browser URL bar. Extraction, HR review and contract download are not covered.
