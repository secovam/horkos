# Invitation management

HR creates and emails an invitation, cancels a draft, resends with a replacement link, and revokes access.

## Sub-features

- `invite-create` persists and emails an invitation.
- `invite-cancel` closes a draft without saving.
- `invite-duplicate` rejects a second active invitation for the same email.
- `invite-resend` rotates the link after sending succeeds.
- `invite-revoke` removes access and moves the row to revoked records.

## How to get to it (user POV)

- Open `/invitaciones` and choose `Nueva invitación`.
- Choose the row's `Reenviar: Verification Employee` or `Revocar: Verification Employee` action, then confirm or cancel.

## Driving it with T3 preview

Preconditions: fictional HR session and no active invitation for the resolved `employee-$VERIFY_RUN@example.com`. Record fixture row IDs and newly captured email paths after each send.

- **Cancel.** Click `role=button[name='Nueva invitación']`; type `Verification Employee` into `input[name='employeeName']` and the resolved fixture email into `input[name='email']`, using the snapshot to confirm those handles. Click `role=button[name='Cancelar']`. Require dialog closes with unchanged run-owned invitation/mail counts.
- **Create.** Reopen the dialog and fill the labels `Nombre del empleado` and `Correo electrónico` with the same fictional values. Click `role=button[name='Enviar invitación']`. Require `Invitación enviada`, a filtered row, a new local email containing the employee link, and read-only count one for the fixture email. Save its ID and sent timestamp without exposing its hash.
- **Duplicate.** Repeat creation with the same email. Require `Ya existe una invitación activa para este correo.` and no additional row/mail. Close the dialog.
- **Resend.** Filter to the fixture and click `role=button[name='Reenviar: Verification Employee']`. Require `¿Reenviar la invitación?`; cancel once and check unchanged mail count/link validity. Reopen and confirm `role=button[name='Reenviar']`. Require `Invitación reenviada`, a new local message, and a later `sent_at`. The old employee link must fail and the new one must work.
- **Revoke.** Click `role=button[name='Revocar: Verification Employee']`. Require `¿Revocar la invitación?`; cancel once and confirm the link still works. Reopen and click `role=button[name='Revocar']`. Require `Invitación revocada`; the row disappears from `Activas`, appears in `Revocadas`, and the current link fails. Read-only query must show non-null `revoked_at`.
- **Reinvite.** After revocation, creating another invitation for the same email must succeed with a new link. Record the new row for cleanup too.

## Gotchas

- Create persists before sending mail. If mail fails, the row remains and the UI says `La invitación se guardó, pero no se pudo enviar el correo. Intenta reenviarla.`. Resend instead of expecting rollback.
- Resend sends before rotating the token; send failure must preserve the prior link. Verify failure only when an existing boundary can safely simulate it; report untested failure cases.
- Dialog and row buttons can share text. Scope ambiguous actions to the visible dialog or alertdialog from the snapshot.
