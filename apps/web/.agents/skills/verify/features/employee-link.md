# Employee invitation link

Employees open an emailed link without an account. The page records opening, shows the submission form while the invitation is open, and shows a confirmation once it was submitted. Each PDF is uploaded and read as soon as it is picked, and the form is prefilled from it. HR review and contract download are not implemented.

## Sub-features

- `employee-scanner`: HTML GET does not mark the invitation opened.
- `employee-first-open`: hydration marks the first visit and later visits preserve its timestamp.
- `employee-phone-notice`: a touch-primary device (phone or tablet, 390 × 844 with `isMobile` and `hasTouch`) sees `Abre este enlace en una computadora` instead of the form, and the first opening is still recorded.
- `employee-referrer`: token page uses `no-referrer`.
- `employee-upload-prefill`: picking a PDF uploads it at once to R2 (`invitations/{id}/employee/{kind}`), upserts its `document` row, sends it to the extractor and upserts an `extraction` row (`status` `extracted`, `unreadable` or `failed`, `fields`, `warnings`). The field's description shows "Subiendo y leyendo tu documento…", then "Llenamos tus datos con este documento. Revísalos." and the matching form fields fill in. Fields the person already typed are never overwritten. An unreadable PDF or an extractor error leaves the fields empty and says "No pudimos leer este documento. Escribe tus datos a mano.". A proof of address that is neither CFE nor Telmex shows "No parece un recibo de CFE o Telmex. Sube uno de esos." and does not block.
- `employee-return-replace`: reloading an open invitation shows each uploaded document ("Ya subiste {archivo}. Elige otro para reemplazarlo.") and prefills from the stored extractions. Hand-typed fields are not saved before submit. Choosing a new file overwrites the same R2 object and updates the same `document` and `extraction` rows.
- `employee-submit`: needs all 3 documents uploaded (constancia fiscal, IMSS, comprobante de domicilio; PDF only, up to 10 MB) plus nombre completo (prefilled), RFC, CURP, NSS and the address. Submitting stores one `submission` row with what the person confirmed (the proposed values stay in `extraction`) and sets `submitted_at` (HR sees "Recibida"). Reloading shows "Recibimos tu información".
- `employee-file-validation`: the type is checked on the server by magic bytes, so a text file renamed `.pdf` or a PNG is rejected with an inline error on that document's field, and an oversize file is refused before uploading. Nothing is stored.
- `employee-tour`: the first open of an open invitation starts a 5 step driver.js tour (welcome, Documentos, Datos personales, Domicilio, Enviar) after hydration. It closes with the X, Esc, an overlay tap or "Listo", and `localStorage` key `horkos:submission-tour:v1` (no token) stops it reappearing. "¿Cómo lleno esto?" replays it. Dismiss it first (button "Cerrar guía") before driving the form, since it blocks clicks.
- `employee-revoked-submit`: a form opened before HR revoked the link cannot upload or submit.
- `employee-lifecycle`: old, revoked and replaced links stay unavailable, including after reactivation.

## How to get to it (user POV)

Open the original emailed link, a resend/reactivation email, or a previously used link. No account or HR session is needed.

## Driving it with Playwright

```sh
pnpm --filter web exec playwright test invitations.spec.ts --grep 'scanner GET|resend invalidates|failed resend'
pnpm --filter web test:e2e submission.spec.ts
```

The scanner test obtains a real UI-created invitation, fetches its HTML, and checks `opened_at` remains null. It opens the email link in an independent anonymous desktop context (1280 × 900), requires the form heading `Completa tu información`, waits for the database timestamp, reloads and waits for the hydration POST before checking the same timestamp. It verifies the referrer meta tag and saves `employee.png`. An unknown link requires `Este enlace no está disponible`; dashboard remains protected in the employee context. A separate test opens the link in a phone context and requires the computer notice, no form fields and a recorded `opened_at`. `submission.spec.ts` drives the full form in a 1280 × 900 desktop context with generated fixture PDFs (a `%PDF-1.4` header followed by fictional markdown, which the stand-in `extractor` Durable Object in `runtime.ts` returns as the document text; a body containing `EXTRACTOR_FAILURE` makes it answer 500), inspects D1 and the Miniflare R2 bucket, and saves `form-prefilled.png`. The real container is not run there; build and curl `apps/extractor` with Docker for that. Lifecycle recipes check original/replaced/revoked/reactivated links individually.

## Gotchas

HTML alone does not prove hydration tracking. Keep old URLs locally until the replacement check finishes. Traces contain fictional tokens; redact them before sharing. Screenshots capture page content without the browser URL bar. HR review of extractions and contract download are not covered.
