import type { Page } from "@playwright/test";

import { login, toastMessage } from "./actions";
import { expect, test } from "./fixtures";
import { TURNSTILE_PASSING_TOKEN } from "./runtime";
import type { LocalApp } from "./runtime";

// Stands in for Cloudflare's widget script: hands the form `token` as soon as it renders.
async function stubTurnstile(page: Page, token = TURNSTILE_PASSING_TOKEN) {
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.turnstile = {
        render(el, options) { setTimeout(() => options.callback(${JSON.stringify(token)})); return "widget"; },
        remove() {},
      };
      window.onTurnstileLoad?.();`,
    })
  );
}

async function registerAs(page: Page, name: string, email: string) {
  await page.getByLabel("Nombre completo").fill(name);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByRole("button", { name: "Registrarme" }).click();
}

async function rows(app: LocalApp, sql: string) {
  const { results } = await app.db.prepare(sql).all();

  return results;
}

function count(app: LocalApp, table: string, where = "1") {
  return app.db
    .prepare(`SELECT count(*) AS count FROM ${table} WHERE ${where}`)
    .first("count");
}

test("an employee registers once; a repeated email gets the same answer", async ({
  app,
  page,
  browser,
}) => {
  await stubTurnstile(page);
  await page.goto(`${app.baseURL}/registro`);
  await registerAs(page, "Registro Ana", "Registro.Ana@example.com");
  await expect(
    page.getByRole("heading", { name: "Gracias por registrarte" })
  ).toBeVisible();

  const again = await browser.newPage();

  try {
    await stubTurnstile(again);
    await again.goto(`${app.baseURL}/registro`);
    await registerAs(again, "Otra Persona", "registro.ana@example.com");
    await expect(
      again.getByRole("heading", { name: "Gracias por registrarte" })
    ).toBeVisible();
  } finally {
    await again.close();
  }

  expect(
    await rows(app, "SELECT employee_name, email FROM registration")
  ).toEqual([
    { employee_name: "Registro Ana", email: "registro.ana@example.com" },
  ]);
  expect(await count(app, "invitation")).toBe(0);
});

test("a failed Turnstile check stores nothing and lets the employee retry", async ({
  app,
  page,
}) => {
  await stubTurnstile(page, "turnstile-fail");
  await page.goto(`${app.baseURL}/registro`);
  await registerAs(page, "Registro Bot", "bot@example.com");
  await expect(
    toastMessage(
      page,
      "No pudimos verificar que no eres un robot. Intenta de nuevo."
    )
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrarme" })).toBeVisible();
  expect(await count(app, "registration")).toBe(0);
});

test("HR edits, deletes and invites all registrations; the cron emails them", async ({
  app,
  page,
}) => {
  await app.db.batch([
    ...[
      ["reg-1", "Registro Ana", "ana@example.com"],
      ["reg-2", "Registro Beto", "beto.typo@example.com"],
      ["reg-3", "Registro Spam", "spam@example.com"],
      ["reg-4", "Registro Carla", "carla@example.com"],
    ].map((row) =>
      app.db
        .prepare(
          "INSERT INTO registration (id, employee_name, email) VALUES (?, ?, ?)"
        )
        .bind(...row)
    ),
    // Carla already has an invitation, so "Invitar a todos" must skip her.
    app.db.prepare(
      "INSERT INTO invitation (id, employee_name, email, revoked_at) VALUES ('inv-carla', 'Carla Existente', 'carla@example.com', 1)"
    ),
  ]);

  await login(app, page);
  await page.getByRole("link", { name: "Registros", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Registros", exact: true })
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Editar: Registro Beto", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Correo electrónico").fill("ana@example.com");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(
    toastMessage(page, "Ya hay otro registro con este correo.")
  ).toBeVisible();
  await dialog.getByLabel("Correo electrónico").fill("beto@example.com");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("row").filter({ hasText: "beto@example.com" })
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Borrar: Registro Spam", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Borrar", exact: true })
    .click();
  await expect(page.getByRole("row").filter({ hasText: "spam@" })).toBeHidden();

  await page.getByRole("button", { name: "Invitar a todos" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Invitar a todos" })
    .click();
  await expect(toastMessage(page, "2 invitaciones en cola")).toBeVisible();
  await expect(page.getByText("No hay registros pendientes")).toBeVisible();

  expect(await count(app, "registration")).toBe(0);
  expect(
    await rows(
      app,
      "SELECT employee_name, email, created_by FROM invitation WHERE sent_at IS NULL AND revoked_at IS NULL ORDER BY email"
    )
  ).toEqual([
    {
      employee_name: "Registro Ana",
      email: "ana@example.com",
      created_by: "verification-hr",
    },
    {
      employee_name: "Registro Beto",
      email: "beto@example.com",
      created_by: "verification-hr",
    },
  ]);
  expect(
    await app.db
      .prepare("SELECT employee_name FROM invitation WHERE id = 'inv-carla'")
      .first("employee_name")
  ).toBe("Carla Existente");

  expect(await app.runScheduled()).toBe("ok");
  await expect
    .poll(async () => {
      const messages = await app.getMail();

      return (
        messages
          .map(({ to }) => to)
          .filter((to) => to !== "verification-hr@example.com")
          // oxlint-disable-next-line unicorn/no-array-sort -- Fresh array; TypeScript targets ES2022.
          .sort()
      );
    })
    .toEqual(["ana@example.com", "beto@example.com"]);
});
