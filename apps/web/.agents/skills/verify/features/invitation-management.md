# Invitation management

HR creates invitations, replaces links, revokes access, and reactivates with a fresh emailed link.

## Sub-features

- `invite-cancel-create-duplicate`: cancel writes nothing; create stores and emails; duplicate sends nothing.
- `invite-resend`: old link stops working and replacement works.
- `invite-revoke-reactivate`: revoke blocks access; reactivate sends fresh token on the same row.
- `invite-revoked-email`: creation is denied until HR uses reactivation.
- `invite-delivery-failure`: failed resend preserves the old link; failed reactivation remains revoked.

## How to get to it (user POV)

Open the list and `Nueva invitación`. Row actions are `Reenviar: Verification Employee`, `Revocar: Verification Employee`, and, in `Revocadas`, `Reactivar: Verification Employee`. Confirm in the alert dialog or choose `Cancelar`.

## Driving it with Playwright

```sh
pnpm --filter web exec playwright test invitations.spec.ts --grep 'cancel does|resend invalidates|failed resend|revoked email'
```

The recipes fill `Nombre del empleado` and `Correo electrónico`, submit `Enviar invitación`, and verify visible rows and captured mail. Cancellation and duplicates preserve row/mail counts. Lifecycle tests open both original and replacement links in an anonymous browser and require validity to track resend/revoke/reactivate. Reactivation preserves one invitation row and never restores the compromised old token. Failure tests reject only the external `EMAIL.send` boundary, then check real recovery through the UI and employee route.

## Gotchas

Create persists before send; a failed initial delivery leaves a row that HR can resend. A revoked email cannot be reinvited by creating another row; reactivate it from `Revocadas`. Resend swaps the hash before mail and restores the prior hash if delivery fails. Reactivation delivery failure revokes again. Buttons with identical labels must be scoped to the alert dialog. Initial-create failure and action cancellation are additional manual cases when those branches change.
