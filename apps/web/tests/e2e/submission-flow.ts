import { expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

import { invitationLink } from "./actions";
import type { LocalApp } from "./runtime";

// The stand-in extractor returns whatever follows the header line as the document text.
export function pdf(text = "") {
  return Buffer.from(`%PDF-1.4\n${text}`);
}

export function pdfFile(name: string, text = "") {
  return { name, mimeType: "application/pdf", buffer: pdf(text) };
}

export const SAT_TEXT = `| RFC: | XAXX010101AB1 |
| CURP: | XEXX010101HNERXX08 |
| Nombre (s): | MARIA |
| Primer Apellido: | FICTICIA |
| Segundo Apellido: | PRUEBA |`;

export const IMSS_TEXT = `Seguridad Social 12345678901
Curp XEXX010101HNERXX08`;

export const CFE_TEXT = `COMISIÓN FEDERAL DE ELECTRICIDAD
###### CALLE FALSA 123 CENTRO C.P. 01000`;

export const LABELS = {
  taxStatus: "Constancia de situación fiscal",
  imss: "Constancia del IMSS (NSS)",
  proofOfAddress: "Comprobante de domicilio (Telmex o CFE)",
} as const;

export const FILLED_BY_HAND = {
  Teléfono: "55 1234 5678",
  "Nombre del beneficiario": "Luis Ficticio Prueba",
} as const;

export async function fillByHand(page: Page) {
  await page.getByLabel("Estado civil", { exact: true }).click();
  await page.getByRole("option", { name: "Casado/a" }).click();

  for (const [label, value] of Object.entries(FILLED_BY_HAND)) {
    // oxlint-disable-next-line no-await-in-loop -- Fields are filled in reading order like a person would.
    await page.getByLabel(label, { exact: true }).fill(value);
  }

  await page.getByLabel("Parentesco", { exact: true }).click();
  await page.getByRole("option", { name: "Hermano/a" }).click();
}

export function tourPopover(page: Page) {
  return page.locator(".driver-popover");
}

export const DESKTOP = { width: 1280, height: 900 };

export async function dismissTour(page: Page) {
  await page.getByRole("button", { name: "Cerrar guía" }).click();
  await expect(tourPopover(page)).toBeHidden();
}

export async function openForm(browser: Browser, app: LocalApp) {
  const context = await browser.newContext({ viewport: DESKTOP });
  const employee = await context.newPage();

  await employee.goto(await invitationLink(app, 1));
  await expect(
    employee.getByRole("heading", { name: "Completa tu información" })
  ).toBeVisible();
  await dismissTour(employee);

  return { context, employee };
}

export async function submitWithAllDocuments(
  employee: Page,
  { rfc }: { rfc?: string } = {}
) {
  await employee
    .getByLabel(LABELS.taxStatus)
    .setInputFiles(pdfFile("sat.pdf", SAT_TEXT));
  await expect(employee.getByLabel("RFC", { exact: true })).toHaveValue(
    "XAXX010101AB1"
  );

  await employee
    .getByLabel(LABELS.imss)
    .setInputFiles(pdfFile("imss.pdf", IMSS_TEXT));
  await expect(
    employee.getByLabel("Número de seguridad social (NSS)")
  ).toHaveValue("12345678901");

  await employee
    .getByLabel(LABELS.proofOfAddress)
    .setInputFiles(pdfFile("cfe.pdf", CFE_TEXT));
  await expect(employee.getByLabel("Código postal")).toHaveValue("01000");
  await expect(employee.getByLabel("RFC", { exact: true })).toBeEnabled();

  if (rfc) {
    await employee.getByLabel("RFC", { exact: true }).fill(rfc);
  }

  await fillByHand(employee);
  await employee.getByRole("button", { name: "Enviar mi información" }).click();
  await expect(
    employee.getByRole("heading", { name: "Recibimos tu información" })
  ).toBeVisible();
}
