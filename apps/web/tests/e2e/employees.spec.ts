import { invite, login } from "./actions";
import { expect, test } from "./fixtures";
import { openForm, submitWithAllDocuments } from "./submission-flow";

test("HR reviews a submitted employee and opens their document", async ({
  app,
  page,
  browser,
}) => {
  await login(app, page);
  await page.getByRole("link", { name: "Invitaciones", exact: true }).click();
  await invite(page);

  const { context, employee } = await openForm(browser, app);

  try {
    await submitWithAllDocuments(employee, { rfc: "XBXX020202CD3" });
  } finally {
    await context.close();
  }

  await page.getByRole("link", { name: "Empleados", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "employee@example.com" });

  await expect(row).toContainText("Verification Employee");
  await expect(row).toContainText("Revisar");
  await page.screenshot({
    path: test.info().outputPath("employees-list.png"),
    fullPage: true,
  });

  await row.getByRole("link", { name: /Ver detalle/u }).click();
  await expect(
    page.getByRole("heading", { name: "Verification Employee" })
  ).toBeVisible();

  const rfc = page
    .locator("div")
    .filter({ has: page.getByRole("term").getByText("RFC", { exact: true }) })
    .last();

  await expect(rfc).toContainText("XBXX020202CD3");
  await expect(rfc).toContainText("Constancia de situación fiscal");
  await expect(rfc).toContainText("XAXX010101AB1");
  await expect(rfc).toContainText("Difiere");

  const nss = page
    .locator("div")
    .filter({
      has: page.getByRole("term").getByText("Número de seguridad social (NSS)"),
    })
    .last();

  await expect(nss).toContainText("Coincide");
  await expect(page.getByText("Luis Ficticio Prueba")).toBeVisible();
  await expect(page.getByText("Casado/a")).toBeVisible();
  await expect(
    page.getByText("Ningún documento lo propuso").first()
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("employee-detail.png"),
    fullPage: true,
  });

  const link = page.getByRole("link", { name: "Ver documento" }).first();
  const href = await link.getAttribute("href");

  expect(href).toMatch(/^\/api\/documentos\/[^/]+\/[a-z_]+$/u);
  await expect(link).toHaveAttribute("target", "_blank");

  const signedIn = await page.request.get(`${app.baseURL}${href}`);

  expect(signedIn.status()).toBe(200);
  expect(signedIn.headers()["content-type"]).toBe("application/pdf");
  expect(signedIn.headers()["cache-control"]).toBe("private, no-store");

  const anonymous = await browser.newContext();

  try {
    const denied = await anonymous.request.get(`${app.baseURL}${href}`);

    expect(denied.status()).toBe(401);
  } finally {
    await anonymous.close();
  }
});

test("an unknown employee shows a not-found state", async ({ app, page }) => {
  await login(app, page);
  await page.goto(`${app.baseURL}/empleados/does-not-exist`);
  await expect(page.getByText("No encontramos este empleado")).toBeVisible();
});
