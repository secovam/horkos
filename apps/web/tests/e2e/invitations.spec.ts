import {
  confirmAction,
  invitationLink,
  invite,
  login,
  toastMessage,
} from "./actions";
import { expect, test } from "./fixtures";

test.beforeEach(async ({ app, page }) => {
  await login(app, page);
  await page.getByRole("link", { name: "Invitaciones", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Invitaciones", exact: true })
  ).toBeVisible();
});

test("cancel does not create an invitation and duplicate email cannot send another", async ({
  app,
  page,
}) => {
  await page.getByRole("button", { name: "Nueva invitación" }).first().click();
  await page.getByLabel("Nombre del empleado").fill("Cancelled Employee");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(
    await app.db
      .prepare("SELECT count(*) AS count FROM invitation")
      .first("count")
  ).toBe(0);
  await invite(page, "Verification Employee", "EMPLOYEE@example.com");
  await invitationLink(app, 1);
  await page.getByRole("button", { name: "Nueva invitación" }).first().click();
  await page.getByLabel("Nombre del empleado").fill("Duplicate Employee");
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill("employee@example.com");
  await page
    .getByRole("button", { name: "Enviar invitación", exact: true })
    .click();
  await expect(
    toastMessage(page, "Ya existe una invitación activa para este correo.")
  ).toBeVisible();
  expect(await app.getMail()).toHaveLength(2);
  expect(
    await app.db
      .prepare("SELECT count(*) AS count FROM invitation")
      .first("count")
  ).toBe(1);
});

test("scanner GET leaves unopened; mobile anonymous visit records first opening once", async ({
  app,
  page,
  browser,
}) => {
  await invite(page);
  const link = await invitationLink(app, 1);
  const response = await page.request.get(link);
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Tu invitación fue recibida");
  expect(
    await app.db.prepare("SELECT opened_at FROM invitation").first("opened_at")
  ).toBeNull();

  const employee = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });

  try {
    const employeePage = await employee.newPage();
    await employeePage.goto(link);
    await expect(
      employeePage.getByRole("heading", { name: "Tu invitación fue recibida" })
    ).toBeVisible();
    await expect(employeePage.locator('meta[name="referrer"]')).toHaveAttribute(
      "content",
      "no-referrer"
    );
    await expect
      .poll(() =>
        app.db.prepare("SELECT opened_at FROM invitation").first("opened_at")
      )
      .not.toBeNull();

    const openedAt = await app.db
      .prepare("SELECT opened_at FROM invitation")
      .first("opened_at");

    const reopened = employeePage.waitForResponse(
      (result) =>
        result.request().method() === "POST" &&
        result.url().includes("/_serverFn/")
    );

    await employeePage.reload();
    const reopenedResponse = await reopened;
    expect(reopenedResponse.ok()).toBe(true);
    await expect(
      employeePage.getByRole("heading", { name: "Tu invitación fue recibida" })
    ).toBeVisible();
    expect(
      await app.db
        .prepare("SELECT opened_at FROM invitation")
        .first("opened_at")
    ).toBe(openedAt);
    await employeePage.screenshot({
      path: test.info().outputPath("mobile-employee.png"),
    });
    await employeePage.goto(`${app.baseURL}/invitacion/not-a-valid-token`);
    await expect(
      employeePage.getByRole("heading", {
        name: "Este enlace no está disponible",
      })
    ).toBeVisible();
    await employeePage.goto(`${app.baseURL}/dashboard`);
    await expect(employeePage).toHaveURL(/\/login$/u);
  } finally {
    await employee.close();
  }
});

test("resend invalidates old link; revoke blocks it; reactivate sends a fresh link", async ({
  app,
  page,
  browser,
}) => {
  await invite(page);
  const original = await invitationLink(app, 1);
  await confirmAction(page, "Reenviar");
  const resent = await invitationLink(app, 2);
  expect(resent).not.toBe(original);
  const employee = await browser.newPage();

  try {
    await employee.goto(original);
    await expect(
      employee.getByRole("heading", { name: "Este enlace no está disponible" })
    ).toBeVisible();
    await employee.goto(resent);
    await expect(
      employee.getByRole("heading", { name: "Tu invitación fue recibida" })
    ).toBeVisible();
    await confirmAction(page, "Revocar");
    await expect(
      page.getByRole("button", { name: "Revocar: Verification Employee" })
    ).toBeHidden();
    await employee.reload();
    await expect(
      employee.getByRole("heading", { name: "Este enlace no está disponible" })
    ).toBeVisible();
    await page.getByRole("tab", { name: /Revocadas/u }).click();
    await confirmAction(page, "Reactivar");
    const reactivated = await invitationLink(app, 3);
    expect(reactivated).not.toBe(resent);
    await employee.goto(resent);
    await expect(
      employee.getByRole("heading", { name: "Este enlace no está disponible" })
    ).toBeVisible();
    await employee.goto(reactivated);
    await expect(
      employee.getByRole("heading", { name: "Tu invitación fue recibida" })
    ).toBeVisible();
    await page.getByRole("tab", { name: /Activas/u }).click();
    await expect(
      page.getByRole("row").filter({ hasText: "employee@example.com" })
    ).toBeVisible();
    expect(
      await app.db
        .prepare("SELECT count(*) AS count FROM invitation")
        .first("count")
    ).toBe(1);
  } finally {
    await employee.close();
  }
});

test("failed resend restores old link and failed reactivation remains revoked", async ({
  app,
  page,
  browser,
}) => {
  await invite(page);
  const original = await invitationLink(app, 1);
  await app.failDelivery(true);
  await confirmAction(page, "Reenviar");
  await expect(
    toastMessage(
      page,
      "La invitación se guardó, pero no se pudo enviar el correo. Intenta reenviarla."
    )
  ).toBeVisible();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancelar" })
    .click();
  const employee = await browser.newPage();

  try {
    await employee.goto(original);
    await expect(
      employee.getByRole("heading", { name: "Tu invitación fue recibida" })
    ).toBeVisible();
    await confirmAction(page, "Revocar");
    await page.getByRole("tab", { name: /Revocadas/u }).click();
    await confirmAction(page, "Reactivar");
    await expect(
      toastMessage(
        page,
        "No se pudo enviar el correo, así que la invitación sigue revocada."
      )
    ).toBeVisible();
    await employee.reload();
    await expect(
      employee.getByRole("heading", { name: "Este enlace no está disponible" })
    ).toBeVisible();
    expect(await app.getMail()).toHaveLength(2);
    expect(
      await app.db
        .prepare("SELECT revoked_at FROM invitation")
        .first("revoked_at")
    ).not.toBeNull();
  } finally {
    await employee.close();
  }
});

test("revoked email must be reactivated instead of creating a second invitation", async ({
  app,
  page,
}) => {
  await invite(page);
  await confirmAction(page, "Revocar");
  await expect(
    page.getByRole("button", { name: "Revocar: Verification Employee" })
  ).toBeHidden();
  await page.getByRole("button", { name: "Nueva invitación" }).first().click();
  await page.getByLabel("Nombre del empleado").fill("Replacement Employee");
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill("employee@example.com");
  await page
    .getByRole("button", { name: "Enviar invitación", exact: true })
    .click();
  await expect(
    toastMessage(
      page,
      "Este correo tiene una invitación revocada. Reactívala desde la pestaña Revocadas."
    )
  ).toBeVisible();
  expect(
    await app.db
      .prepare("SELECT count(*) AS count FROM invitation")
      .first("count")
  ).toBe(1);
  expect(await app.getMail()).toHaveLength(2);
});

test("literal wildcard search stays out of request URLs and tabs follow filtered counts", async ({
  page,
}) => {
  await invite(page, "Percent 50%_ Employee", "literal@example.com");
  await invite(page, "Percent 500X Employee", "ordinary@example.com");
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  await page
    .getByRole("searchbox", { name: "Filtrar por nombre o correo" })
    .fill("50%_");
  await expect(
    page.getByRole("row").filter({ hasText: "ordinary@example.com" })
  ).toBeHidden();
  await expect(
    page.getByRole("row").filter({ hasText: "literal@example.com" })
  ).toBeVisible();
  expect(
    urls.every(
      (url) =>
        !decodeURIComponent(url).includes("50%_") &&
        !url.includes("literal@example.com")
    )
  ).toBe(true);
  // The random port can contain "50", so only the path and query count.
  const { pathname, search } = new URL(page.url());
  expect(`${pathname}${search}`).not.toContain("50");
  await confirmAction(page, "Revocar", "Percent 50%_ Employee");
  await page.getByRole("tab", { name: /Revocadas/u }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "literal@example.com" })
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /Activas/u })).toContainText("0");
  await expect(page.getByRole("tab", { name: /Revocadas/u })).toContainText(
    "1"
  );
});

test("pagination exposes ten rows, advances and resets when searching", async ({
  page,
}) => {
  for (let index = 0; index < 11; index += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Each invitation is created through the same browser form.
    await invite(page, `Page Employee ${index}`, `page-${index}@example.com`);
  }

  await expect(page.getByRole("row")).toHaveCount(11);
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  await page.getByRole("searchbox").fill("page-10@example.com");
  await expect(
    page.getByRole("row").filter({ hasText: "page-10@example.com" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Anterior" })).toBeDisabled();
  expect(page.url()).not.toContain("page-10");
});

test("dashboard counts opening and excludes the revoked invitation", async ({
  app,
  page,
  browser,
}) => {
  await invite(page);
  const link = await invitationLink(app, 1);
  const employee = await browser.newPage();

  try {
    await employee.goto(link);
    await expect
      .poll(() =>
        app.db.prepare("SELECT opened_at FROM invitation").first("opened_at")
      )
      .not.toBeNull();
    await page
      .getByRole("link", { name: "Inicio", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Invitaciones enviadas" })
    ).toContainText("1");
    await expect(
      page.getByRole("listitem").filter({ hasText: "Invitaciones abiertas" })
    ).toContainText("1");
    await page.getByRole("link", { name: "Invitaciones", exact: true }).click();
    await confirmAction(page, "Revocar");
    await expect(
      page.getByRole("button", { name: "Revocar: Verification Employee" })
    ).toBeHidden();
    await page
      .getByRole("link", { name: "Inicio", exact: true })
      .first()
      .click();
    await page.reload();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Invitaciones enviadas" })
    ).toContainText("0");
    await expect(
      page.getByRole("listitem").filter({ hasText: "Invitaciones abiertas" })
    ).toContainText("0");
  } finally {
    await employee.close();
  }
});
