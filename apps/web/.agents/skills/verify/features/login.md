# HR login

HR requests a magic link by email, opens it to access protected pages, and signs out from the user menu.

## Sub-features

- `login-guard` redirects anonymous visitors from both protected routes.
- `login-validation` rejects missing or malformed email.
- `login-known` emails an existing HR account and establishes a session.
- `login-unknown` gives the same confirmation without mail or a verification row.
- `login-logout` ends the session and restores the guard.

## How to get to it (user POV)

- Open `/login` directly.
- Open `/dashboard` or `/invitaciones` without a session.
- Open the link received by email.
- Choose `Menú de usuario` → `Cerrar sesión` from either protected page.

## Driving it with T3 preview

Preconditions: healthy owned instance, fresh tab, and the fictional local HR fixture from the skill. Record matching email paths, verification-row IDs, and mail counts without reading existing messages.

- **Guard.** `preview_navigate({tabId,url:"http://localhost:3101/dashboard"})`, then `preview_wait_for({tabId,urlIncludes:"/login",text:"Enviar enlace"})`. Repeat for `/invitaciones`.
- **Validation.** Click `role=button[name='Enviar enlace']` with an empty field, then type `invalid` into `#email` and click again. The form must remain without success confirmation or email side effects. Native email validation may prevent the request before Spanish Zod text appears.
- **Unknown address.** Type `unknown-$VERIFY_RUN@example.com` into `#email` using `preview_type` with `clear:true`; click `role=button[name='Enviar enlace']`. Wait for `Hemos enviado un enlace mágico`. Read-only `SELECT count(*) FROM verification;` and the local mail file count must remain unchanged from immediately before the action.
- **Known account.** Navigate back to `/login`, type the resolved `$VERIFY_HR_EMAIL`, and click `Enviar enlace`. Wait for the same confirmation. Require a new local email capture for this address and a new verification row. Open its magic link with `preview_navigate`; require `/dashboard` and heading `Inicio`. Read-only `SELECT count(*) FROM session WHERE user_id='$VERIFY_HR_ID';` must show a session. The link is the genuine auth entry point, not a seeded cookie.
- **Logout.** Click `role=button[name='Menú de usuario']`, then `role=menuitem[name='Cerrar sesión']`. Require `/login`; revisit both protected routes and require redirects. Confirm the fixture's session count returns to zero.

## Gotchas

- Magic links replace passwords; sign-up is disabled. The seed file's named account is not a fictional test fixture.
- The form trims and lowercases email. If testing normalization, compare the captured recipient to the fixture email.
- Both known and unknown addresses show success. The screen alone cannot prove email was sent.
- Local captures contain usable tokens. Keep them local, consume the link, and redact token-bearing URLs from evidence.
