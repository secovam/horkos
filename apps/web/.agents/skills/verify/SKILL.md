---
name: verify
description: Drive Horkos's local web UI to verify HR magic-link login, dashboard metrics, invitations, and employee invitation links. Use after behavior changes or when collecting browser evidence.
---

# Verify Horkos

Read [the feature map](features/README.md), then the relevant recipe. Run from the repository root. Use fictional data only. Never deploy, destroy, access production D1/R2, or send real email.

## Launch

Use the installed pnpm dependencies and the repo's Alchemy dev command. Plain Vite cannot provide the Worker bindings. Prerequisites are pnpm, Bun, sqlite3, installed dependencies, and available T3 preview tools.

Alchemy stores local D1, email, and state in `packages/infra/.alchemy`. A different port or stage does **not** isolate that data. Refuse to drive a checkout with another running dev instance. Check `ps -ax -o pid,ppid,command` for this checkout's Alchemy/Vite/workerd processes and check port 3101 with `lsof -nP -iTCP:3101 -sTCP:LISTEN`. Use a separate checkout with its own dependency installation and `.alchemy` directory if concurrent verification is necessary. Do not drive an existing user's browser tab. T3 tabs can share cookies; a new tab does not guarantee an anonymous context. If Doctor finds an existing session, use an isolated browser context or report the conflict without signing out another user.

Create an evidence directory outside the checkout and keep the variables in your shell session (or persist their values in your task notes).

```sh
VERIFY_RUN=$(date -u +%Y%m%d-%H%M%S)
VERIFY_EVIDENCE="$HOME/Documents/Notes/Dev/Verification/horkos-$VERIFY_RUN"
mkdir -p "$VERIFY_EVIDENCE"
git rev-parse HEAD > "$VERIFY_EVIDENCE/revision.txt"
touch "$VERIFY_EVIDENCE/mail-before"
PORTLESS=0 PORT=3101 pnpm dev
```

Run the final command in an owned PTY/exec session. Record its session ID. `PORTLESS=0` bypasses the shared portless proxy; the Worker URL becomes `http://localhost:3101`. Defaults come from `.env.schema`; do not print secret overrides. Wait for `[web] ready at http://localhost:3101` and require the plan to identify database/web as `(local)`. Save a sanitized startup transcript. Dev email is captured under `packages/infra/.alchemy/local/email`, rather than delivered. Do not opt resources into `Alchemy.remote()`.

Stop with Ctrl-C through the exact session you started, including on failed attempts. Confirm port 3101 is no longer listening. Never kill by process name.

## Doctor

Run this read-only check whenever anything looks wrong.

```sh
lsof -nP -iTCP:3101 -sTCP:LISTEN
curl --fail --silent http://localhost:3101/login > "$VERIFY_EVIDENCE/login.html"
```

Inspect the listener's PID and parents with `ps` and require them to belong to the recorded launch session in this checkout. Require the response to contain `Horkos`, `Correo electrónico`, and `Enviar enlace`. Compare the current revision to `revision.txt`; a changed working tree requires relaunch. A rendered `/` heading alone does not prove auth or D1 works. Check `/dashboard` in the fresh browser tab; without a session it must redirect to `/login`.

## Drive

Prefer T3's collaborative preview. Call `preview_status`, then `preview_open({reuseExistingTab:false})` to create an owned tab, even if another tab exists. Keep its returned `tabId` on every action. Navigate with `preview_navigate({tabId,url:"http://localhost:3101/login"})`, inspect with `preview_snapshot`, and use `preview_type`, `preview_click`, and `preview_wait_for` with the map's locators. Do not use DOM setters, app internals, injected cookies, or test-only endpoints as proof. If T3 explicitly reports unavailable, use an available browser harness with the same routes and locators; do not add a dependency just for this skill. The checkout has Vitest logic tests but no Playwright configuration/specs.

For HR flows, create a fictional local account as fixture setup. There is no sign-up or password login. Do not use the repository's named seed account or inspect existing users. Locate local SQLite files with `rg --files --hidden --no-ignore packages/infra/.alchemy/local/d1`; exclude `metadata.sqlite` and WAL/SHM files. Require exactly one application `.sqlite` database whose read-only `.tables` includes `user`, `session`, `verification`, and `invitation`. Set `VERIFY_DB` to that path. If ambiguous, stop and diagnose rather than guess.

```sh
VERIFY_HR_ID="verify-$VERIFY_RUN"
VERIFY_HR_EMAIL="verify-$VERIFY_RUN@example.com"
sqlite3 "$VERIFY_DB" "INSERT INTO user (id,name,email,email_verified) VALUES ('$VERIFY_HR_ID','Verification HR','$VERIFY_HR_EMAIL',1);"
```

This is fixture setup only. Authenticate by submitting the real login form, opening its newly captured local email link, and observing the dashboard. Record the exact fixture IDs and newly created email paths for cleanup. Read only mail created after `mail-before` and addressed to this run's fictional accounts; existing mail may contain private data. The installed simulator writes `text/*.txt` and `html/*.html` and logs their paths. Extract the link from the matching text capture locally; never paste tokens into reports. For invitation recipes use employee name `Verification Employee` and email `employee-$VERIFY_RUN@example.com`. Seed no session or invitation rows to bypass the flow being tested. Keep fixture emails lowercase, since the login form lowercases submissions. Avoid editing files while driving; Vite reloads can clear a form between typing and clicking. Inspect the field value before submitting if a reload occurs.

## Evidence

Keep proof in `$VERIFY_EVIDENCE`. Record feature/sub-feature IDs, entry points, actions, expected/observed results, revision, and skips in `proof.md`. Capture before/action/after snapshots, not just a final screen. `preview_snapshot({tabId,save:true})` returns a screenshot path; copy it into the evidence directory. Save text metadata and the relevant request's method/path/status, stripping tokens and cookies. Use `preview_recording_start/stop` when a recording helps; copy its returned file into the evidence directory. Keep recordings away from token-bearing navigation.

Verify visible state and side effects together. Local email capture proves simulated delivery only. Use `sqlite3 -readonly "$VERIFY_DB"` to query only your fixture rows; select counts/timestamps and boolean state, never session tokens, token hashes, or unrelated personal data. Reopen pages to check persistence. For unknown-address login, record unchanged verification-row and local-mail counts. For resend, test both the old and new employee links. Mocks belong only at existing external boundaries; use Alchemy's actual local email simulator here. It still writes files, which must be observed.

Report unreachable entries and unmet preconditions explicitly. Do not claim uploads, extraction, HR review, or PDF generation are verified; those flows do not exist in this checkout. Browser screenshots of invitation URLs can expose access tokens, so redact URLs from shared evidence.

## Cleanup

Sign out through `Menú de usuario` → `Cerrar sesión`. Revoke invitations created by this run through the UI before removing fixtures. On failures, still remove only the exact recorded run's local fixture rows.

```sh
sqlite3 "$VERIFY_DB" "PRAGMA foreign_keys=ON; BEGIN; DELETE FROM invitation WHERE created_by='$VERIFY_HR_ID'; DELETE FROM session WHERE user_id='$VERIFY_HR_ID'; DELETE FROM account WHERE user_id='$VERIFY_HR_ID'; DELETE FROM user WHERE id='$VERIFY_HR_ID' AND email='$VERIFY_HR_EMAIL'; COMMIT;"
```

If a login link was never consumed, remove only its recorded new verification row by ID, after checking it was created by this run. Remove only recorded new local email capture files belonging to fictional recipients. Never wipe `.alchemy` or delete other users' state. Navigate the owned browser tab to `about:blank`, stop the owned dev session with Ctrl-C, and confirm the listener is gone. Keep `$VERIFY_EVIDENCE` and confirm `proof.md` and screenshots still exist after teardown.

## Helpers

No bundled helper or new harness dependency. Commands above use the existing dev runner and SQLite CLI; the feature map supplies concrete browser actions. Use `pstack:maintain-verification-skill` when app routes or selectors change.
