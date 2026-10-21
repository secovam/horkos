import { readFile } from "node:fs/promises";

import type { Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { clickUntil, invite, login, toastMessage } from "./actions";
import { expect, test } from "./fixtures";
import { openForm, pdfFile, submitWithAllDocuments } from "./submission-flow";

const IMSS_REGISTRATION_TEXT = `Fecha y hora de recepción del lote: 2026-03-20 08:17
Relación de movimientos operados
Tipo NSS Nombre Asegurado Sal. Base Ext. UMF Tipo Fec-Mov Tipo C. Baja
8 12345678901 PRUEBA FICTICIA MARIA $ 695.55 1 069 0 02/03/2026 1 0
Fec-Mov (Fecha de movimiento), NSS (Número de Seguridad Social)`;

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

  const serverFnRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().includes("/_serverFn/")
  );

  await row.getByRole("link", { name: /Ver detalle/u }).click();
  await expect(
    page.getByRole("heading", { name: "Maria Ficticia Prueba" })
  ).toBeVisible();

  const captured = await serverFnRequest;

  function replay(fetchSite: string) {
    return page.request.post(captured.url(), {
      headers: { ...captured.headers(), "sec-fetch-site": fetchSite },
      data: captured.postDataBuffer() ?? undefined,
    });
  }

  const sameSite = await replay("same-origin");
  const crossSite = await replay("cross-site");
  expect(sameSite.status()).toBe(200);
  expect(crossSite.status()).toBe(403);

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

  const documents = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Documentos" }) });

  await expect(
    documents.getByRole("link", { name: "Ver documento" })
  ).toHaveCount(3);
  await expect(documents.getByText("Leído", { exact: true })).toHaveCount(0);

  const toTop = page.getByRole("button", { name: "Volver arriba" });
  await expect(toTop).toBeHidden();
  await documents.scrollIntoViewIfNeeded();
  await expect(toTop).toBeVisible();
  await toTop.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(toTop).toBeHidden();

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
  await expect(
    page.getByRole("dialog").getByLabel("RFC", { exact: true })
  ).toBeVisible();
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
  await expect(page.getByRole("dialog")).toBeHidden();
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
  await expect(page.getByText("Elige el puesto.")).toBeVisible();
  await expect(page.getByText("Elige la empresa.")).toBeVisible();

  await page.getByRole("combobox", { name: "Puesto" }).fill("compras");
  await page.getByRole("option", { name: "Analista de Compras" }).click();
  await page.getByRole("combobox", { name: "Empresa" }).click();
  await page.getByRole("option", { name: "SECOVAM" }).click();
  await page.getByRole("combobox", { name: "Sexo" }).click();
  await page.getByRole("option", { name: "Femenino" }).click();
  await page.getByLabel("Fecha de ingreso").fill("2026-03-05");

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
  await page.getByLabel("Fecha de ingreso").fill("");
  await page
    .getByLabel("Alta del IMSS")
    .setInputFiles(pdfFile("alta.pdf", IMSS_REGISTRATION_TEXT));
  await expect(page.getByText("Ya subiste alta.pdf")).toBeVisible();
  await expect(page.getByLabel("Salario diario")).toHaveValue("695.55");
  await expect(page.getByLabel("Fecha de ingreso")).toHaveValue("2026-03-02");
  const autoExtracted = page.getByRole("dialog").getByText("Auto-extraído");
  await expect(autoExtracted).toHaveCount(2);
  await expect(autoExtracted.first()).toBeVisible();
  await expect(autoExtracted.last()).toBeVisible();

  await page.getByLabel("Salario diario").fill("700");
  await page.getByLabel("Fecha de ingreso").fill("2026-03-05");
  await page
    .getByLabel("Alta del IMSS")
    .setInputFiles(pdfFile("alta-2.pdf", IMSS_REGISTRATION_TEXT));
  await expect(page.getByText("Ya subiste alta-2.pdf")).toBeVisible();
  await expect(page.getByLabel("Salario diario")).toHaveValue("700");
  await expect(
    page.getByText("El alta del IMSS indica $695.55.")
  ).toBeVisible();
  await expect(page.getByLabel("Fecha de ingreso")).toHaveValue("2026-03-05");
  await expect(autoExtracted.first()).toBeHidden();
  await expect(autoExtracted.last()).toBeHidden();
  await expect(
    page.getByText("El alta del IMSS indica 2 de marzo de 2026.")
  ).toBeVisible();

  await page.getByLabel("Fecha de ingreso").fill("2026-03-02");

  await page.getByLabel("Salario diario").fill("695.55");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(toastMessage(page, "Datos laborales guardados")).toBeVisible();

  await page.reload();
  await expect(fieldRow(page, "Correo de trabajo (opcional)")).toContainText(
    "—"
  );
  await expect(fieldRow(page, "Empresa")).toContainText("SECOVAM");
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
  await page.getByRole("combobox", { name: "Puesto" }).fill("almacén");
  await page.getByRole("option", { name: "Jefe de Almacén" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(toastMessage(page, "Datos laborales guardados")).toBeVisible();
  await expect(fieldRow(page, "Puesto")).toContainText("Jefe de Almacén");

  await clickUntil(
    page.getByRole("button", { name: "Editar datos laborales" }),
    page.getByLabel("Puesto")
  );
  await page
    .getByLabel("Alta del IMSS")
    .setInputFiles(pdfFile("alta-3.pdf", IMSS_REGISTRATION_TEXT));
  await expect(page.getByText("Ya subiste alta-3.pdf")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await clickUntil(
    page.getByRole("button", { name: "Editar datos laborales" }),
    page.getByLabel("Puesto")
  );
  await expect(page.getByText("Ya subiste alta-3.pdf")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();

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

  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "Descargar contrato" }).click();
  const contract = await downloading;
  expect(contract.suggestedFilename()).toBe(
    "Contrato Maria Ficticia Prueba.pdf"
  );

  const filled = await PDFDocument.load(await readFile(await contract.path()));
  const form = filled.getForm();

  expect(form.getTextField("name").getText()).toBe("Maria Ficticia Prueba");
  expect(form.getTextField("marital_status").getText()).toBe("Casada");
  expect(form.getTextField("role").getText()).toBe("Jefe de Almacén");
  expect(form.getTextField("salary_number").getText()).toBe("695.55");
  expect(form.getTextField("salary_text").getText()).toBe(
    "SEISCIENTOS NOVENTA Y CINCO PESOS 55/100"
  );
  expect(form.getTextField("beneficiary_role").getText()).toBe("Hermano/a");

  await expect(
    page.getByRole("navigation", { name: "breadcrumb" })
  ).toContainText("Maria Ficticia Prueba");
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
  await expect(
    page.getByRole("link", { name: "Descargar contrato" })
  ).toBeHidden();

  const reopened = await page.request.get(
    `${app.baseURL}/api/contratos/${new URL(page.url()).pathname.split("/").at(-1)}`
  );

  expect(reopened.status()).toBe(404);
});
