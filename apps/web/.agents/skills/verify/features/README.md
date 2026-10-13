# Horkos verification map

All recipes use the disposable Playwright harness from [verify](../SKILL.md). Build once, run Doctor, then run the relevant command. Each test owns its database, mail, port and browser context. Preserve evidence before another invocation replaces default results.

- [HR login](login.md): guard, known/unknown account, magic link and logout.
- [Dashboard](dashboard.md): invitation/open counts, revoked exclusion and navigation.
- [Invitation browsing](invitation-list.md): literal search, private URLs, tabs and pagination.
- [Invitation management](invitation-management.md): create/cancel/duplicate, resend/revoke/reactivate and delivery failures.
- [Employee link](employee-link.md): scanner GET, anonymous desktop visit, phone notice, first-open tracking and stale links.

Wait for assertions or the specific server response rather than a fixed delay. Report tested feature IDs and uncovered entries. Uploads, extraction, HR completion and PDF download have no user routes yet; this map does not claim to verify them.
