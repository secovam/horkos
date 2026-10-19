import type { Page } from "@playwright/test";

import { clickUntil, invite, login, toastMessage } from "./actions";
import { expect, test } from "./fixtures";
import { openForm, pdfFile, submitWithAllDocuments } from "./submission-flow";

const IMSS_REGISTRATION_TEXT = `Relación de movimientos operados
12345678901 FICTICIA PRUEBA MARIA ALTA $ 695.55`;

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
  await expect(page.getByText("Ningún documento lo propuso")).toHaveCount(0);
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

function fieldRow(page: Page, label: string) {
  return page
    .locator("div")
    .filter({ has: page.getByRole("term").getByText(label, { exact: true }) })
    .last();
}

function metric(page: Page, label: string) {
  return page.getByRole("listitem").filter({ hasText: label });
}

test("HR corrects the data, confirms the record and reopens it", async ({
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

  const awaitingHr = "Empleados pendientes de información de RH";
  const awaitingContract = "Contratos pendientes de generar";

  await page.goto(`${app.baseURL}/dashboard`);
  await expect(metric(page, awaitingHr)).toContainText("1");
  await expect(metric(page, awaitingContract)).toContainText("0");

  await page.getByRole("link", { name: "Empleados", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "employee@example.com" })
    .getByRole("link", { name: /Ver detalle/u })
    .click();
  await expect(fieldRow(page, "RFC")).toContainText("Difiere");

  await page.getByRole("button", { name: "Editar datos", exact: true }).click();
  await expect(page.getByLabel("Municipio o alcaldía")).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Colonia" })).toBeVisible();
  await page.getByLabel("RFC", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(
    page.getByText("Escribe un RFC válido de 13 caracteres.")
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("employee-edit.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.reload();
  await expect(fieldRow(page, "RFC")).toContainText("XBXX020202CD3");

  await clickUntil(
    page.getByRole("button", { name: "Editar datos", exact: true }),
    page.getByLabel("RFC", { exact: true })
  );
  await page.getByLabel("RFC", { exact: true }).fill("xaxx010101ab1");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(toastMessage(page, "Datos guardados")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Editar datos", exact: true })
  ).toBeVisible();
  await expect(fieldRow(page, "RFC")).toContainText("Coincide");

  await page.reload();
  await expect(fieldRow(page, "RFC")).toContainText("XAXX010101AB1");
  await expect(fieldRow(page, "RFC")).toContainText("Coincide");

  await expect(
    page.getByText("RH aún no completa los datos laborales")
  ).toBeVisible();
  await clickUntil(
    page.getByRole("button", { name: "Confirmar datos" }),
    page.getByRole("alertdialog")
  );
  await expect(page.getByRole("alertdialog")).toContainText(
    "Completa los datos laborales antes de confirmar"
  );
  await expect(
    page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Confirmar datos" })
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancelar" }).click();

  await clickUntil(
    page.getByRole("button", { name: "Completar datos laborales" }),
    page.getByLabel("Puesto")
  );
  await expect(
    page.getByRole("button", { name: "Editar datos", exact: true })
  ).toBeHidden();
  await expect(page.getByLabel("Correo personal")).toHaveValue(
    "employee@example.com"
  );
  await expect(page.getByLabel("Nacionalidad")).toHaveValue("Mexicana");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Escribe el puesto.")).toBeVisible();
  await expect(page.getByText("Elige al menos una empresa.")).toBeVisible();

  await page
    .getByRole("textbox", { name: "Correo de trabajo" })
    .fill("ana.prueba");
  await page.getByLabel("Puesto").fill("Analista de calidad");
  await page.getByLabel("Jefe inmediato (opcional)").fill("Luis Ficticio");
  await page.getByRole("combobox", { name: "Departamento" }).click();
  await page.getByRole("option", { name: "Calidad" }).click();
  await page.getByRole("combobox", { name: "Oficina" }).click();
  await page.getByRole("option", { name: "CDMX" }).click();
  await page.getByRole("checkbox", { name: "SERALAM" }).click();
  await page.getByRole("checkbox", { name: "SECOVAM" }).click();
  await page.getByRole("combobox", { name: "Sexo" }).click();
  await page.getByRole("option", { name: "Femenino" }).click();
  await page.getByLabel("Fecha de ingreso").fill("2026-03-02");

  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Escribe el salario diario.")).toBeVisible();

  await page.getByLabel("Salario diario").fill("200");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(
    page.getByText("El salario diario debe ser al menos $315.00.")
  ).toBeVisible();

  await page.getByLabel("Salario diario").fill("700");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Sube el alta del IMSS antes de guardar los datos laborales.")
  ).toBeVisible();

  await page.getByLabel("Salario diario").fill("");
  await page
    .getByLabel("Alta del IMSS")
    .setInputFiles(pdfFile("alta.pdf", IMSS_REGISTRATION_TEXT));
  await expect(page.getByText("Leído: $695.55")).toBeVisible();
  await expect(page.getByLabel("Salario diario")).toHaveValue("695.55");

  await page.getByLabel("Salario diario").fill("700");
  await page
    .getByLabel("Alta del IMSS")
    .setInputFiles(pdfFile("alta-2.pdf", IMSS_REGISTRATION_TEXT));
  await expect(page.getByText("Ya subiste alta-2.pdf")).toBeVisible();
  await expect(page.getByLabel("Salario diario")).toHaveValue("700");
  await expect(
    page.getByText("El alta del IMSS indica $695.55.")
  ).toBeVisible();

  await page.getByLabel("Salario diario").fill("695.55");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(toastMessage(page, "Datos laborales guardados")).toBeVisible();

  await page.reload();
  await expect(fieldRow(page, "Correo de trabajo")).toContainText(
    "ana.prueba@secovam.com"
  );
  await expect(fieldRow(page, "Empresas")).toContainText("SERALAM, SECOVAM");
  await expect(fieldRow(page, "Sexo")).toContainText("Femenino");
  await expect(fieldRow(page, "Fecha de ingreso")).toContainText(
    "2 de marzo de 2026"
  );
  await expect(fieldRow(page, "Salario diario")).toContainText("$695.55");
  await expect(page.getByText("alta-2.pdf")).toBeVisible();
  await clickUntil(
    page.getByRole("button", { name: "Editar datos laborales" }),
    page.getByLabel("Puesto")
  );
  await expect(page.getByLabel("Salario diario")).toHaveValue("695.55");
  await page.getByLabel("Puesto").fill("Coordinadora de calidad");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(toastMessage(page, "Datos laborales guardados")).toBeVisible();
  await expect(fieldRow(page, "Puesto")).toContainText(
    "Coordinadora de calidad"
  );

  await clickUntil(
    page.getByRole("button", { name: "Confirmar datos" }),
    page.getByRole("alertdialog")
  );
  await expect(page.getByRole("alertdialog")).toContainText(
    "se usarán en el contrato"
  );
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar datos" })
    .click();

  await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Editar datos", exact: true })
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Editar datos laborales" })
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Corregir datos" })
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("employee-confirmed.png"),
    fullPage: true,
  });

  await expect(
    page.getByRole("navigation", { name: "breadcrumb" })
  ).toContainText("Verification Employee");
  await page
    .getByRole("navigation", { name: "breadcrumb" })
    .getByRole("link", { name: "Empleados" })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "employee@example.com" })
  ).toContainText("Confirmado");

  await page.goto(`${app.baseURL}/dashboard`);
  await expect(metric(page, awaitingHr)).toContainText("0");
  await expect(metric(page, awaitingContract)).toContainText("1");

  await page.getByRole("link", { name: "Empleados", exact: true }).click();
  await page.getByRole("link", { name: /Ver detalle/u }).click();
  await page.getByRole("button", { name: "Corregir datos" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Corregir datos" })
    .click();
  await expect(
    page.getByRole("button", { name: "Editar datos", exact: true })
  ).toBeVisible();
  await expect(page.getByText("Confirmado", { exact: true })).toBeHidden();
});
