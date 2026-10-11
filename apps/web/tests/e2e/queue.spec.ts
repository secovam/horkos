import type { Page } from "@playwright/test";

import { confirmAction, login } from "./actions";
import { expect, test } from "./fixtures";
import type { LocalApp } from "./runtime";

const EMPLOYEES = [
  { id: "queued-1", name: "Queued Ana", email: "queued.ana@example.com" },
  { id: "queued-2", name: "Queued Beto", email: "queued.beto@example.com" },
  { id: "queued-3", name: "Queued Carla", email: "queued.carla@example.com" },
];

const REVOKED = {
  id: "queued-revoked",
  name: "Queued Revoked",
  email: "queued.revoked@example.com",
};

const EMAILED_ONCE = {
  "queued.ana@example.com": 1,
  "queued.beto@example.com": 1,
  "queued.carla@example.com": 1,
  "queued.revoked@example.com": 0,
};

const NEVER_EMAILED = {
  "queued.ana@example.com": 0,
  "queued.beto@example.com": 0,
  "queued.carla@example.com": 0,
  "queued.revoked@example.com": 0,
};

async function seedQueued(app: LocalApp) {
  await app.db.batch([
    ...EMPLOYEES.map(({ id, name, email }) =>
      app.db
        .prepare(
          "INSERT INTO invitation (id, employee_name, email) VALUES (?, ?, ?)"
        )
        .bind(id, name, email)
    ),
    app.db
      .prepare(
        "INSERT INTO invitation (id, employee_name, email, revoked_at) VALUES (?, ?, ?, 1)"
      )
      .bind(REVOKED.id, REVOKED.name, REVOKED.email),
  ]);
}

async function mailCounts(app: LocalApp) {
  const messages = await app.getMail();

  return Object.fromEntries(
    [...EMPLOYEES, REVOKED].map(({ email }) => [
      email,
      messages.filter((message) => message.to === email).length,
    ])
  );
}

function count(app: LocalApp, where: string) {
  return app.db
    .prepare(`SELECT count(*) AS count FROM invitation WHERE ${where}`)
    .first("count");
}

async function openInvitations(app: LocalApp, page: Page) {
  await login(app, page);
  await page.goto(`${app.baseURL}/invitaciones?tab=active&page=1`);
}

test("queued invitations are enqueued by the cron and emailed exactly once", async ({
  app,
  page,
}) => {
  await seedQueued(app);
  await openInvitations(app, page);

  await Promise.all(
    EMPLOYEES.map(async ({ email }) => {
      const row = page.getByRole("row").filter({ hasText: email });
      await expect(row.getByText("En cola")).toBeVisible();
      await expect(row.getByText("—")).toBeVisible();
    })
  );

  await app.runScheduled();
  await expect.poll(() => mailCounts(app)).toStrictEqual(EMAILED_ONCE);

  // A second cron tick finds nothing left to enqueue and nothing is sent twice.
  await app.runScheduled();
  // oxlint-disable-next-line sonarjs/no-fixed-wait-in-tests -- Absence of another email has no event to wait on.
  await page.waitForTimeout(2000);
  expect(await mailCounts(app)).toStrictEqual(EMAILED_ONCE);

  expect(
    await count(
      app,
      "sent_at IS NOT NULL AND token_hash IS NOT NULL AND enqueued_at IS NULL"
    )
  ).toBe(3);
  expect(
    await app.db
      .prepare(
        "SELECT sent_at, token_hash, enqueued_at FROM invitation WHERE id = ?"
      )
      .bind(REVOKED.id)
      .first()
  ).toStrictEqual({ sent_at: null, token_hash: null, enqueued_at: null });

  await page.reload();

  await Promise.all(
    EMPLOYEES.map(({ email }) =>
      expect(
        page.getByRole("row").filter({ hasText: email }).getByText("Pendiente")
      ).toBeVisible()
    )
  );
});

test("a failed delivery is rolled back and retried by the queue", async ({
  app,
  page,
}) => {
  await seedQueued(app);
  await openInvitations(app, page);
  await app.failDelivery(true);
  await app.runScheduled();

  await expect.poll(() => count(app, "enqueued_at IS NOT NULL")).toBe(3);
  // oxlint-disable-next-line sonarjs/no-fixed-wait-in-tests -- Absence of another email has no event to wait on.
  await page.waitForTimeout(2500);
  expect(await mailCounts(app)).toStrictEqual(NEVER_EMAILED);
  expect(
    await count(app, "sent_at IS NOT NULL OR token_hash IS NOT NULL")
  ).toBe(0);

  await app.failDelivery(false);

  await expect
    .poll(() => mailCounts(app), { timeout: 20_000 })
    .toStrictEqual(EMAILED_ONCE);
});

test("HR can send a queued invitation right away", async ({ app, page }) => {
  await seedQueued(app);
  await openInvitations(app, page);

  await confirmAction(page, "Reenviar", "Queued Ana");

  const row = page
    .getByRole("row")
    .filter({ hasText: "queued.ana@example.com" });

  await expect(row.getByText("Pendiente")).toBeVisible();
  await expect
    .poll(() => mailCounts(app))
    .toMatchObject({ "queued.ana@example.com": 1 });

  // The cron skips Ana, who is already sent, and emails only the rest.
  await app.runScheduled();
  await expect
    .poll(() => mailCounts(app))
    .toMatchObject({ "queued.beto@example.com": 1 });
  // oxlint-disable-next-line sonarjs/no-fixed-wait-in-tests -- Absence of another email has no event to wait on.
  await page.waitForTimeout(1500);
  expect(await mailCounts(app)).toStrictEqual(EMAILED_ONCE);
});

test("the cron re-enqueues invitations whose queue message was lost", async ({
  app,
  page,
}) => {
  await seedQueued(app);
  // Ana's claim is ancient with no message behind it; Beto's is fresh and may still be in flight.
  await app.db.batch([
    app.db
      .prepare("UPDATE invitation SET enqueued_at = 1 WHERE id = ?")
      .bind("queued-1"),
    app.db
      .prepare("UPDATE invitation SET enqueued_at = ? WHERE id = ?")
      .bind(Date.now(), "queued-2"),
  ]);

  await app.runScheduled();

  await expect
    .poll(() => mailCounts(app))
    .toStrictEqual({
      ...EMAILED_ONCE,
      "queued.beto@example.com": 0,
    });
  // oxlint-disable-next-line sonarjs/no-fixed-wait-in-tests -- Absence of another email has no event to wait on.
  await page.waitForTimeout(1500);
  expect(await mailCounts(app)).toMatchObject({ "queued.beto@example.com": 0 });
});

test("the queue retries a send whose rollback also failed", async ({
  app,
  page,
}) => {
  await seedQueued(app);
  // What a failed delivery leaves when its rollback fails too: a hash and sent_at nobody emailed.
  await app.db
    .prepare(
      "UPDATE invitation SET token_hash = 'unsent-hash', sent_at = 1, enqueued_at = 1 WHERE id = ?"
    )
    .bind("queued-1")
    .run();

  await app.runScheduled();

  await expect.poll(() => mailCounts(app)).toStrictEqual(EMAILED_ONCE);
  expect(
    await count(app, "token_hash = 'unsent-hash' OR enqueued_at IS NOT NULL")
  ).toBe(0);

  await app.runScheduled();
  // oxlint-disable-next-line sonarjs/no-fixed-wait-in-tests -- Absence of another email has no event to wait on.
  await page.waitForTimeout(1500);
  expect(await mailCounts(app)).toStrictEqual(EMAILED_ONCE);
});
