# HR login

HR requests an email magic link, opens it, and signs out.

## Sub-features

- `login-guard`: anonymous protected routes redirect to login.
- `login-known`: uppercase email resolves to the fictional HR account and opens dashboard.
- `login-unknown`: same confirmation with no mail, verification row or session.
- `login-logout`: user menu ends the real auth session.

## How to get to it (user POV)

Open `/login` or a protected `/dashboard` or `/invitaciones` route. Open the emailed magic link. From an authenticated page choose `Menú de usuario` → `Cerrar sesión`.

## Driving it with Playwright

```sh
pnpm --filter web exec playwright test auth.spec.ts
```

The known-account test opens `/dashboard`, requires `/login`, fills `Correo electrónico`, clicks `Enviar enlace`, reads the captured recipient and magic link, requires dashboard, then uses the user menu to log out. Unknown-account coverage opens the canonical `/invitaciones?tab=active&page=1` route anonymously and checks the confirmation and zero mail/verification/session rows. Keep native empty/malformed email rejection as an additional manual case when changing validation.

## Gotchas

No sign-up or password login exists. A success screen alone does not prove mail delivery or a session. Keep tokens local; never seed a session to bypass authentication. Known limitation: direct canonical invitation navigation proves its guard. In this local Worker build, bare `/invitaciones` adds defaults with a 307 redirect and its follow-up request can hang; this entry is not covered by the passing guard test. Diagnose that normalization redirect separately before claiming bare-route coverage.
