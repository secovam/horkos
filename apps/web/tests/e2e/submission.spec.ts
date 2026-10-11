import type { Page } from "@playwright/test";

import {
  confirmAction,
  invitationLink,
  invite,
  login,
  toastMessage,
} from "./actions";
import { expect, test } from "./fixtures";
import type { LocalApp } from "./runtime";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);

const FIELDS = {
  RFC: "xaxx010101ab1",
  CURP: "xexx010101hnerxx08",
  "Número de seguridad social (NSS)": "12345678901",
  Calle: "Calle Falsa",
  "Número exterior": "123",
  Colonia: "Centro",
  "Código postal": "01000",
  "Municipio o alcaldía": "Benito Juárez",
  Estado: "Ciudad de México",
} as const;

async function fillFields(page: Page) {
  for (const [label, value] of Object.entries(FIELDS)) {
    // oxlint-disable-next-line no-await-in-loop -- Fields are filled in reading order like a person would.
    await page.getByLabel(label, { exact: true }).fill(value);
  }
}

async function attachDocuments(page: Page, taxStatus = PDF) {
  await page.getByLabel("Constancia de situación fiscal").setInputFiles({
    name: "constancia.pdf",
    mimeType: "application/pdf",
    buffer: taxStatus,
  });
  await page.getByLabel("Constancia del IMSS (NSS)").setInputFiles({
    name: "imss.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page.getByLabel("Comprobante de domicilio").setInputFiles({
    name: "domicilio.jpg",
    mimeType: "image/jpeg",
    buffer: JPEG,
  });
}

function count(app: LocalApp, table: string) {
  return app.db
    .prepare(`SELECT count(*) AS count FROM ${table}`)
    .first("count");
}

test.beforeEach(async ({ app, page }) => {
  await login(app, page);
  await page.getByRole("link", { name: "Invitaciones", exact: true }).click();
  await invite(page);
});

test("employee submits documents and data from a phone; HR sees it received", async ({
  app,
  page,
  browser,
}) => {
  const link = await invitationLink(app, 1);

  const employee = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  try {
    const phone = await employee.newPage();
    await phone.goto(link);
    await expect(
      phone.getByRole("heading", { name: "Completa tu información" })
    ).toBeVisible();
    await expect(phone.getByLabel("Nombre completo")).toHaveValue(
      "Verification Employee"
    );

    await phone.getByRole("button", { name: "Enviar mi información" }).click();
    await expect(phone.getByText("Sube este documento.").first()).toBeVisible();
    await expect(
      phone.getByText("El código postal tiene 5 dígitos.")
    ).toBeVisible();
    expect(await count(app, "submission")).toBe(0);

    await fillFields(phone);
    await attachDocuments(phone, Buffer.from("<script>not a pdf</script>"));
    await phone.getByRole("button", { name: "Enviar mi información" }).click();
    await expect(
      toastMessage(
        phone,
        "Constancia de situación fiscal: sube un archivo PDF, JPG o PNG."
      )
    ).toBeVisible();
    expect(await count(app, "submission")).toBe(0);
    expect(await app.listObjects()).toHaveLength(0);

    await attachDocuments(phone);
    await expect(phone.getByLabel("RFC", { exact: true })).toHaveValue(
      "xaxx010101ab1"
    );
    await phone.screenshot({
      path: test.info().outputPath("form-filled.png"),
      fullPage: true,
    });
    await phone.getByRole("button", { name: "Enviar mi información" }).click();
    await expect(
      phone.getByRole("heading", { name: "Recibimos tu información" })
    ).toBeVisible();
    await phone.screenshot({
      path: test.info().outputPath("submitted.png"),
      fullPage: true,
    });

    const stored = await app.db
      .prepare("SELECT rfc, curp, nss, full_name, int_number FROM submission")
      .first();

    expect(stored).toEqual({
      rfc: "XAXX010101AB1",
      curp: "XEXX010101HNERXX08",
      nss: "12345678901",
      full_name: "Verification Employee",
      int_number: null,
    });
    expect(
      await app.db
        .prepare("SELECT submitted_at FROM invitation")
        .first("submitted_at")
    ).not.toBeNull();

    const { results: documents } = await app.db
      .prepare(
        "SELECT kind, object_key, content_type FROM document ORDER BY kind"
      )
      .all();

    const invitationId = await app.db
      .prepare("SELECT id FROM invitation")
      .first("id");

    expect(documents).toEqual([
      {
        kind: "imss",
        object_key: `invitations/${invitationId}/employee/imss`,
        content_type: "image/png",
      },
      {
        kind: "proof_of_address",
        object_key: `invitations/${invitationId}/employee/proof_of_address`,
        content_type: "image/jpeg",
      },
      {
        kind: "tax_status",
        object_key: `invitations/${invitationId}/employee/tax_status`,
        content_type: "application/pdf",
      },
    ]);
    expect(await app.listObjects()).toEqual(
      documents.map((row) => row.object_key)
    );

    const pdf = await app.getObject(
      `invitations/${invitationId}/employee/tax_status`
    );

    expect(pdf?.bytes).toEqual(new Uint8Array(PDF));

    await phone.reload();
    await expect(
      phone.getByRole("heading", { name: "Recibimos tu información" })
    ).toBeVisible();
    await expect(phone.getByLabel("RFC", { exact: true })).toBeHidden();

    await page.reload();
    await expect(
      page.getByRole("row").filter({ hasText: "employee@example.com" })
    ).toContainText("Recibida");
  } finally {
    await employee.close();
  }
});

test("a revoked link cannot submit, even from an already open form", async ({
  app,
  page,
  browser,
}) => {
  const link = await invitationLink(app, 1);

  const employee = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });

  try {
    const phone = await employee.newPage();
    await phone.goto(link);
    await expect(
      phone.getByRole("heading", { name: "Completa tu información" })
    ).toBeVisible();
    await fillFields(phone);
    await attachDocuments(phone);

    await confirmAction(page, "Revocar");
    await expect(
      page.getByRole("button", { name: "Revocar: Verification Employee" })
    ).toBeHidden();

    await phone.getByRole("button", { name: "Enviar mi información" }).click();
    await expect(
      toastMessage(
        phone,
        "Este enlace ya no está disponible. Pide uno nuevo a Recursos Humanos."
      )
    ).toBeVisible();
    expect(await count(app, "submission")).toBe(0);
    expect(await count(app, "document")).toBe(0);
    expect(await app.listObjects()).toHaveLength(0);

    await phone.reload();
    await expect(
      phone.getByRole("heading", { name: "Este enlace no está disponible" })
    ).toBeVisible();
  } finally {
    await employee.close();
  }
});
