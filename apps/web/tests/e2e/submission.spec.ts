import type { Browser, Locator, Page } from "@playwright/test";

import { confirmAction, invitationLink, invite, login } from "./actions";
import { expect, test } from "./fixtures";
import {
  EXTRACTOR_COLD_START_MARKER,
  EXTRACTOR_FAILURE_MARKER,
  SEPOMEX_AREAS,
  SEPOMEX_UNAVAILABLE_CODE,
} from "./runtime";
import type { LocalApp } from "./runtime";

// The stand-in extractor returns whatever follows the header line as the document text.
function pdf(text = "") {
  return Buffer.from(`%PDF-1.4\n${text}`);
}

function pdfFile(name: string, text = "") {
  return { name, mimeType: "application/pdf", buffer: pdf(text) };
}

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

const SAT_TEXT = `| RFC: | XAXX010101AB1 |
| CURP: | XEXX010101HNERXX08 |
| Nombre (s): | MARIA |
| Primer Apellido: | FICTICIA |
| Segundo Apellido: | PRUEBA |`;

const IMSS_TEXT = `Seguridad Social 12345678901
Curp XEXX010101HNERXX08`;

const CFE_TEXT = `COMISIÓN FEDERAL DE ELECTRICIDAD
###### CALLE FALSA 123 CENTRO C.P. 01000`;

const LABELS = {
  taxStatus: "Constancia de situación fiscal",
  imss: "Constancia del IMSS (NSS)",
  proofOfAddress: "Comprobante de domicilio (Telmex o CFE)",
} as const;

const FILLED_BY_HAND = {
  Teléfono: "55 1234 5678",
  "Nombre del beneficiario": "Luis Ficticio Prueba",
} as const;

async function fillByHand(page: Page) {
  await page.getByLabel("Estado civil", { exact: true }).click();
  await page.getByRole("option", { name: "Casado/a" }).click();

  for (const [label, value] of Object.entries(FILLED_BY_HAND)) {
    // oxlint-disable-next-line no-await-in-loop -- Fields are filled in reading order like a person would.
    await page.getByLabel(label, { exact: true }).fill(value);
  }

  await page.getByLabel("Parentesco", { exact: true }).click();
  await page.getByRole("option", { name: "Hermano/a" }).click();
}

function extractedBadge(page: Page, label: string) {
  return page
    .locator('[data-slot="field"]')
    .filter({ has: page.getByLabel(label, { exact: true }) })
    .getByText("Auto-extraído");
}

function tourPopover(page: Page) {
  return page.locator(".driver-popover");
}

const DESKTOP = { width: 1280, height: 900 };

async function expectOnScreen(locator: Locator) {
  const box = await locator.boundingBox();

  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(DESKTOP.width);
  expect(box?.y).toBeGreaterThanOrEqual(0);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
    DESKTOP.height
  );
}

async function dismissTour(page: Page) {
  await page.getByRole("button", { name: "Cerrar guía" }).click();
  await expect(tourPopover(page)).toBeHidden();
}

function count(app: LocalApp, table: string) {
  return app.db
    .prepare(`SELECT count(*) AS count FROM ${table}`)
    .first("count");
}

function row(app: LocalApp, sql: string) {
  return app.db.prepare(sql).first();
}

async function openForm(browser: Browser, app: LocalApp) {
  const context = await browser.newContext({ viewport: DESKTOP });
  const employee = await context.newPage();

  await employee.goto(await invitationLink(app, 1));
  await expect(
    employee.getByRole("heading", { name: "Completa tu información" })
  ).toBeVisible();
  await dismissTour(employee);

  return { context, employee };
}

test.beforeEach(async ({ app, page }) => {
  await login(app, page);
  await page.getByRole("link", { name: "Invitaciones", exact: true }).click();
  await invite(page);
});

test("employee uploads documents, reviews the prefilled data and submits; HR sees it received", async ({
  app,
  page,
  browser,
}) => {
  const { context, employee } = await openForm(browser, app);

  try {
    await expect(employee.getByLabel("Nombre completo")).toHaveValue(
      "Verification Employee"
    );

    await employee
      .getByRole("button", { name: "Enviar mi información" })
      .click();
    await expect(
      employee.getByText("Sube este documento.").first()
    ).toBeVisible();
    expect(await count(app, "submission")).toBe(0);

    await expect(employee.getByLabel("Nombre completo")).toBeDisabled();

    await employee
      .getByLabel(LABELS.taxStatus)
      .setInputFiles(pdfFile("sat.pdf", SAT_TEXT));
    await expect(employee.getByLabel("Nombre completo")).toHaveValue(
      "Maria Ficticia Prueba"
    );
    await expect(employee.getByLabel("RFC", { exact: true })).toHaveValue(
      "XAXX010101AB1"
    );
    await expect(employee.getByLabel("CURP")).toHaveValue("XEXX010101HNERXX08");
    await expect(
      employee.getByText("Llenamos tus datos con este documento. Revísalos.")
    ).toBeVisible();
    expect(await app.listObjects()).toHaveLength(1);
    await expect(employee.getByLabel("RFC", { exact: true })).toBeDisabled();

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
    // The document's "CENTRO" becomes the catalog's spelling, and the catalog fills the rest.
    await expect(employee.getByLabel("Colonia")).toContainText("Centro");
    await expect(employee.getByLabel("Municipio o alcaldía")).toHaveValue(
      SEPOMEX_AREAS["01000"].municipality
    );
    await expect(employee.getByLabel("Municipio o alcaldía")).toBeDisabled();
    await expect(employee.getByLabel("Estado", { exact: true })).toHaveValue(
      SEPOMEX_AREAS["01000"].state
    );
    await expect(employee.getByLabel("Estado", { exact: true })).toBeDisabled();
    await expect(
      employee.getByText("No parece un recibo de CFE o Telmex.")
    ).toBeHidden();
    await expect(employee.getByLabel("RFC", { exact: true })).toBeEnabled();

    await expect(extractedBadge(employee, "RFC")).toBeVisible();
    await expect(
      employee
        .getByRole("alert")
        .filter({ hasText: "Revisa los datos marcados como Auto-extraído" })
    ).toBeVisible();
    await expect(extractedBadge(employee, "Código postal")).toBeVisible();
    await expect(extractedBadge(employee, "Estado")).toBeHidden();

    await employee.getByLabel("RFC", { exact: true }).fill("xaxx010101ab2");
    await employee.getByLabel("Calle", { exact: true }).fill("Calle Escrita");
    await expect(extractedBadge(employee, "RFC")).toBeHidden();

    for (const [label, file] of [
      [LABELS.taxStatus, pdfFile("sat.pdf", SAT_TEXT)],
      [LABELS.proofOfAddress, pdfFile("cfe.pdf", CFE_TEXT)],
    ] as const) {
      const reread = employee.waitForResponse(
        (response) => response.request().method() === "POST"
      );

      // oxlint-disable-next-line no-await-in-loop -- Each document is read again before the next one.
      await employee.getByLabel(label).setInputFiles(file);
      // oxlint-disable-next-line no-await-in-loop -- Each document is read again before the next one.
      await reread;
    }

    await expect(employee.getByLabel("RFC", { exact: true })).toBeEnabled();

    await expect(employee.getByLabel("RFC", { exact: true })).toHaveValue(
      "xaxx010101ab2"
    );
    await expect(employee.getByLabel("Calle", { exact: true })).toHaveValue(
      "Calle Escrita"
    );

    await fillByHand(employee);
    await employee.screenshot({
      path: test.info().outputPath("form-prefilled.png"),
      fullPage: true,
    });
    await employee
      .getByRole("button", { name: "Enviar mi información" })
      .click();
    await expect(
      employee.getByRole("heading", { name: "Recibimos tu información" })
    ).toBeVisible();

    expect(await row(app, "SELECT * FROM submission")).toMatchObject({
      full_name: "Maria Ficticia Prueba",
      rfc: "XAXX010101AB2",
      curp: "XEXX010101HNERXX08",
      nss: "12345678901",
      street: "Calle Escrita",
      ext_number: "123",
      int_number: null,
      suburb: "Centro",
      postal_code: "01000",
      city: "Álvaro Obregón",
      marital_status: "married",
      phone: "5512345678",
      beneficiary_name: "Luis Ficticio Prueba",
      beneficiary_relationship: "sibling",
      state: "Ciudad de México",
    });

    const invitationId = await app.db
      .prepare("SELECT id FROM invitation")
      .first("id");

    const { results: documents } = await app.db
      .prepare(
        "SELECT kind, object_key, file_name, content_type FROM document ORDER BY kind"
      )
      .all();

    expect(documents).toEqual([
      {
        kind: "imss",
        object_key: expect.stringMatching(
          `^invitations/${invitationId}/employee/imss/`
        ),
        file_name: "imss.pdf",
        content_type: "application/pdf",
      },
      {
        kind: "proof_of_address",
        object_key: expect.stringMatching(
          `^invitations/${invitationId}/employee/proof_of_address/`
        ),
        file_name: "cfe.pdf",
        content_type: "application/pdf",
      },
      {
        kind: "tax_status",
        object_key: expect.stringMatching(
          `^invitations/${invitationId}/employee/tax_status/`
        ),
        file_name: "sat.pdf",
        content_type: "application/pdf",
      },
    ]);
    const objectKeys = await app.listObjects();

    const satObject = await app.getObject(String(documents[2].object_key));

    expect(objectKeys).toHaveLength(documents.length);
    expect(objectKeys).toEqual(
      expect.arrayContaining(documents.map((document) => document.object_key))
    );
    expect(satObject?.bytes).toEqual(new Uint8Array(pdf(SAT_TEXT)));

    const { results: extractions } = await app.db
      .prepare(
        "SELECT kind, status, fields, warnings FROM extraction ORDER BY kind"
      )
      .all();

    expect(
      extractions.map(({ kind, status, fields, warnings }) => ({
        kind,
        status,
        fields: JSON.parse(String(fields)),
        warnings: JSON.parse(String(warnings)),
      }))
    ).toEqual([
      {
        kind: "imss",
        status: "extracted",
        fields: { nss: "12345678901", curp: "XEXX010101HNERXX08" },
        warnings: [],
      },
      {
        kind: "proof_of_address",
        status: "extracted",
        fields: {
          street: "CALLE FALSA",
          extNumber: "123",
          suburb: "CENTRO",
          postalCode: "01000",
        },
        warnings: [],
      },
      {
        kind: "tax_status",
        status: "extracted",
        fields: {
          fullName: "Maria Ficticia Prueba",
          rfc: "XAXX010101AB1",
          curp: "XEXX010101HNERXX08",
        },
        warnings: [],
      },
    ]);

    await employee.reload();
    await expect(
      employee.getByRole("heading", { name: "Recibimos tu información" })
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("row").filter({ hasText: "employee@example.com" })
    ).toContainText("Recibida");
  } finally {
    await context.close();
  }
});

test("a returning employee finds the uploaded document and can replace it", async ({
  app,
  browser,
}) => {
  const { context, employee } = await openForm(browser, app);

  try {
    await employee
      .getByLabel(LABELS.taxStatus)
      .setInputFiles(pdfFile("sat.pdf", SAT_TEXT));
    await expect(employee.getByLabel("RFC", { exact: true })).toHaveValue(
      "XAXX010101AB1"
    );
    await employee
      .getByLabel(LABELS.imss)
      .setInputFiles(pdfFile("imss.pdf", IMSS_TEXT));
    await employee
      .getByLabel(LABELS.proofOfAddress)
      .setInputFiles(pdfFile("cfe.pdf"));
    await employee.getByLabel("Calle", { exact: true }).fill("No se guarda");

    await employee.reload();
    await expect(
      employee.getByText("Ya subiste sat.pdf. Elige otro para reemplazarlo.")
    ).toBeVisible();
    await expect(employee.getByLabel("RFC", { exact: true })).toHaveValue(
      "XAXX010101AB1"
    );
    await expect(employee.getByLabel("Nombre completo")).toHaveValue(
      "Maria Ficticia Prueba"
    );
    await expect(employee.getByLabel("Calle", { exact: true })).toHaveValue("");
    await expect(employee.getByLabel("Calle", { exact: true })).toBeEnabled();

    const replacement = SAT_TEXT.replace("XAXX010101AB1", "XBXX020202CD3");

    await employee
      .getByLabel(LABELS.taxStatus)
      .setInputFiles(pdfFile("sat-nuevo.pdf", replacement));
    await expect(employee.getByText("Ya subiste sat-nuevo.pdf.")).toBeVisible();
    await expect(employee.getByLabel("RFC", { exact: true })).toHaveValue(
      "XBXX020202CD3"
    );

    const invitationId = await app.db
      .prepare("SELECT id FROM invitation")
      .first("id");

    const objectKey = await app.db
      .prepare("SELECT object_key FROM document WHERE kind = 'tax_status'")
      .first("object_key");

    const replaced = await app.getObject(String(objectKey));

    // The first sat.pdf is gone: one object per document.
    expect(await app.listObjects()).toHaveLength(3);
    expect(objectKey).toMatch(
      new RegExp(`^invitations/${invitationId}/employee/tax_status/`, "u")
    );
    expect(replaced?.bytes).toEqual(new Uint8Array(pdf(replacement)));
    expect(
      await app.db
        .prepare("SELECT file_name FROM document WHERE kind = 'tax_status'")
        .all()
    ).toMatchObject({
      results: [{ file_name: "sat-nuevo.pdf" }],
    });
    expect(
      await app.db
        .prepare("SELECT fields FROM extraction WHERE kind = 'tax_status'")
        .all()
    ).toMatchObject({
      results: [{ fields: expect.stringContaining("XBXX020202CD3") }],
    });
  } finally {
    await context.close();
  }
});

test("unreadable and failed documents leave the fields empty; a wrong issuer only warns", async ({
  app,
  browser,
}) => {
  const { context, employee } = await openForm(browser, app);

  const handWritten =
    "No pudimos leer este documento. Escribe tus datos a mano.";

  try {
    await employee
      .getByLabel(LABELS.taxStatus)
      .setInputFiles(pdfFile("sat.pdf"));
    await expect(employee.getByText(handWritten)).toBeVisible();

    await employee
      .getByLabel(LABELS.imss)
      .setInputFiles(pdfFile("imss.pdf", EXTRACTOR_FAILURE_MARKER));
    await expect(employee.getByText(handWritten)).toHaveCount(2);

    await employee
      .getByLabel(LABELS.proofOfAddress)
      .setInputFiles(
        pdfFile(
          "agua.pdf",
          "Recibo de agua\nCalle: Calle Falsa\nCódigo Postal: 01000"
        )
      );
    await expect(
      employee.getByText(
        "No parece un recibo de CFE o Telmex. Sube uno de esos."
      )
    ).toBeVisible();
    await expect(employee.getByLabel("Código postal")).toHaveValue("01000");

    await expect(employee.getByLabel("RFC", { exact: true })).toHaveValue("");
    await expect(
      employee.getByLabel("Número de seguridad social (NSS)")
    ).toHaveValue("");

    const { results } = await app.db
      .prepare(
        "SELECT kind, status, fields, warnings FROM extraction ORDER BY kind"
      )
      .all();

    expect(results).toEqual([
      { kind: "imss", status: "failed", fields: "{}", warnings: "[]" },
      {
        kind: "proof_of_address",
        status: "extracted",
        fields: expect.any(String),
        warnings: '["not_cfe_or_telmex"]',
      },
      {
        kind: "tax_status",
        status: "unreadable",
        fields: "{}",
        warnings: "[]",
      },
    ]);
    expect(await app.listObjects()).toHaveLength(3);

    await fillByHand(employee);
    await employee.getByLabel("Número exterior").fill("123");
    await employee.getByLabel("Colonia").click();
    await employee.getByRole("option", { name: "Centro" }).click();
    await employee.getByLabel("RFC", { exact: true }).fill("XAXX010101AB1");
    await employee.getByLabel("CURP").fill("XEXX010101HNERXX08");
    await employee
      .getByLabel("Número de seguridad social (NSS)")
      .fill("12345678901");
    await employee
      .getByRole("button", { name: "Enviar mi información" })
      .click();
    await expect(
      employee.getByRole("heading", { name: "Recibimos tu información" })
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("a document read while the extractor is still starting is read on the second try", async ({
  app,
  browser,
}) => {
  const { context, employee } = await openForm(browser, app);

  try {
    await employee
      .getByLabel(LABELS.taxStatus)
      .setInputFiles(
        pdfFile("sat.pdf", `${EXTRACTOR_COLD_START_MARKER}\n${SAT_TEXT}`)
      );
    await expect(employee.getByLabel("RFC", { exact: true })).toHaveValue(
      "XAXX010101AB1"
    );
    await expect(employee.getByLabel("Nombre completo")).toHaveValue(
      "Maria Ficticia Prueba"
    );
  } finally {
    await context.close();
  }
});

test("a file that is not a PDF is refused on its field and nothing is stored", async ({
  app,
  browser,
}) => {
  const { context, employee } = await openForm(browser, app);

  try {
    await employee.getByLabel(LABELS.taxStatus).setInputFiles({
      name: "constancia.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect(
      employee.getByRole("alert").filter({ hasText: "Sube un archivo PDF." })
    ).toBeVisible();

    await employee.getByLabel(LABELS.imss).setInputFiles({
      name: "grande.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    });
    await expect(
      employee
        .getByRole("alert")
        .filter({ hasText: "El archivo pesa más de 10 MB." })
    ).toBeVisible();

    expect(await count(app, "document")).toBe(0);
    expect(await count(app, "extraction")).toBe(0);
    expect(await app.listObjects()).toHaveLength(0);
  } finally {
    await context.close();
  }
});

test("the data fields stay locked until all three documents are read", async ({
  app,
  browser,
}) => {
  const { context, employee } = await openForm(browser, app);

  try {
    await employee
      .getByLabel(LABELS.taxStatus)
      .setInputFiles(pdfFile("sat.pdf", SAT_TEXT));
    await employee
      .getByLabel(LABELS.imss)
      .setInputFiles(pdfFile("imss.pdf", IMSS_TEXT));
    await expect(
      employee.getByLabel("Número de seguridad social (NSS)")
    ).toHaveValue("12345678901");
    await expect(employee.getByLabel("Calle", { exact: true })).toBeDisabled();
    await expect(
      employee.getByText(
        "Se habilita cuando terminemos de leer tus 3 documentos."
      )
    ).toHaveCount(3);

    await employee
      .getByRole("button", { name: "Enviar mi información" })
      .click();
    await expect(
      employee.getByText("Sube este documento.").first()
    ).toBeVisible();
    expect(await count(app, "submission")).toBe(0);

    await employee.getByLabel(LABELS.proofOfAddress).setInputFiles({
      name: "comprobante.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect(employee.getByLabel("Calle", { exact: true })).toBeDisabled();

    await employee
      .getByLabel(LABELS.proofOfAddress)
      .setInputFiles(pdfFile("cfe.pdf", CFE_TEXT));
    await expect(employee.getByLabel("Calle", { exact: true })).toBeEnabled();
    await expect(employee.getByLabel("RFC", { exact: true })).toBeEnabled();
    await expect(
      employee.getByText(
        "Se habilita cuando terminemos de leer tus 3 documentos."
      )
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("a revoked link cannot upload or submit, even from an already open form", async ({
  app,
  page,
  browser,
}) => {
  const { context, employee } = await openForm(browser, app);

  try {
    await employee
      .getByLabel(LABELS.taxStatus)
      .setInputFiles(pdfFile("sat.pdf", SAT_TEXT));
    await expect(employee.getByLabel("RFC", { exact: true })).toHaveValue(
      "XAXX010101AB1"
    );

    await confirmAction(page, "Revocar");
    await expect(
      page.getByRole("button", { name: "Revocar: Verification Employee" })
    ).toBeHidden();

    const unavailable =
      "Este enlace ya no está disponible. Pide uno nuevo a Recursos Humanos.";

    await employee
      .getByLabel(LABELS.imss)
      .setInputFiles(pdfFile("imss.pdf", IMSS_TEXT));
    await expect(
      employee.getByRole("alert").filter({ hasText: unavailable })
    ).toBeVisible();
    expect(await count(app, "document")).toBe(1);
    expect(await app.listObjects()).toHaveLength(1);

    await employee
      .getByRole("button", { name: "Enviar mi información" })
      .click();
    expect(await count(app, "submission")).toBe(0);

    await employee.reload();
    await expect(
      employee.getByRole("heading", { name: "Este enlace no está disponible" })
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("employee gets a guided tour once and can replay it", async ({
  app,
  browser,
}) => {
  const link = await invitationLink(app, 1);

  const employee = await browser.newContext({
    viewport: DESKTOP,
    reducedMotion: "reduce",
  });

  try {
    const desktop = await employee.newPage();
    const popover = tourPopover(desktop);

    await desktop.goto(link);
    await expect(popover).toContainText("Antes de empezar");
    await expect(popover).toContainText("1 de 6");
    await expectOnScreen(popover);
    await expect(
      popover.getByRole("button", { name: "Cerrar guía" })
    ).not.toBeFocused();
    await desktop.screenshot({
      path: test.info().outputPath("tour-step-1.png"),
      animations: "disabled",
    });

    await popover.getByRole("button", { name: "Siguiente" }).click();
    await expect(popover).toContainText("Documentos");
    await expect(popover).toContainText("2 de 6");
    await expect(
      popover.getByRole("button", { name: "Anterior" })
    ).toBeVisible();
    await expect(
      desktop.getByLabel("Constancia de situación fiscal")
    ).toBeInViewport();
    await expectOnScreen(popover);
    await desktop.screenshot({
      path: test.info().outputPath("tour-step-documents.png"),
      animations: "disabled",
    });

    for (const title of [
      "Datos personales",
      "Domicilio",
      "Beneficiario",
      "Enviar",
    ]) {
      // oxlint-disable-next-line no-await-in-loop -- Steps are walked in order like a person would.
      await popover.getByRole("button", { name: /Siguiente|Listo/u }).click();
      // oxlint-disable-next-line no-await-in-loop -- Each step is checked before moving on.
      await expect(popover).toContainText(title);
      // oxlint-disable-next-line no-await-in-loop -- Each step is checked before moving on.
      await expectOnScreen(popover);
    }

    await expect(popover).toContainText("6 de 6");
    await expect(
      desktop.getByRole("button", { name: "Enviar mi información" })
    ).toBeInViewport();
    await popover.getByRole("button", { name: "Listo" }).click();
    await expect(popover).toBeHidden();

    expect(await desktop.evaluate(() => Object.keys(localStorage))).toEqual([
      "horkos:submission-tour:v1",
    ]);

    const hydrated = desktop.waitForResponse(
      (response) => response.request().method() === "POST"
    );

    await desktop.reload();
    await hydrated;
    await expect(popover).toBeHidden();

    await desktop.getByRole("button", { name: "¿Cómo lleno esto?" }).click();
    await expect(popover).toContainText("1 de 6");
    await desktop.keyboard.press("Escape");
    await expect(popover).toBeHidden();

    await desktop.getByRole("button", { name: "¿Cómo lleno esto?" }).click();
    await expect(popover).toContainText("1 de 6");
    await desktop
      .locator(".driver-overlay")
      .click({ position: { x: 2, y: 2 } });
    await expect(popover).toBeHidden();
  } finally {
    await employee.close();
  }
});

test("the tour sits beside each section after scrolling to it", async ({
  app,
  browser,
}) => {
  const link = await invitationLink(app, 1);

  const employee = await browser.newContext({
    viewport: { width: 1440, height: 800 },
  });

  try {
    const desktop = await employee.newPage();
    const popover = tourPopover(desktop);

    await desktop.goto(link);
    await expect(popover).toContainText("1 de 6");

    for (const [step, anchor] of [
      [2, "documents"],
      [3, "personal"],
      [4, "address"],
      [5, "beneficiary"],
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop -- Steps are walked in order like a person would.
      await popover.getByRole("button", { name: "Siguiente" }).click();
      // oxlint-disable-next-line no-await-in-loop -- Each step is checked before moving on.
      await expect(popover).toContainText(`${step} de 6`);
      // oxlint-disable-next-line no-await-in-loop -- Each step is checked before moving on.
      await expect(async () => {
        const box = await popover.boundingBox();

        const section = await desktop
          .locator(`[data-tour="${anchor}"]`)
          .boundingBox();

        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
          section?.x ?? 0
        );
        expect(Math.abs((box?.y ?? 0) - (section?.y ?? 0))).toBeLessThan(16);
      }).toPass();
    }
  } finally {
    await employee.close();
  }
});

test("the postal code picks the suburb list; an unknown one blocks the submit and a down catalog unlocks typing", async ({
  app,
  browser,
}) => {
  const { context, employee } = await openForm(browser, app);

  try {
    for (const [label, file] of [
      [LABELS.taxStatus, pdfFile("sat.pdf", SAT_TEXT)],
      [LABELS.imss, pdfFile("imss.pdf", IMSS_TEXT)],
      [LABELS.proofOfAddress, pdfFile("cfe.pdf", CFE_TEXT)],
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop -- Documents are uploaded one after another like a person would.
      await employee.getByLabel(label).setInputFiles(file);
    }

    await expect(employee.getByLabel("Colonia")).toContainText("Centro");

    const postalCode = employee.getByLabel("Código postal");
    const city = employee.getByLabel("Municipio o alcaldía");

    await postalCode.fill("99999");
    await expect(
      employee.getByText("No encontramos este código postal. Revísalo.")
    ).toBeVisible();
    await expect(city).toBeDisabled();
    await employee
      .getByRole("button", { name: "Enviar mi información" })
      .click();
    await expect(postalCode).toBeFocused();
    expect(await count(app, "submission")).toBe(0);

    await postalCode.fill(SEPOMEX_UNAVAILABLE_CODE);
    await expect(
      employee.getByText(
        "No pudimos consultar los códigos postales. Escribe colonia, municipio y estado."
      )
    ).toBeVisible();
    await expect(city).toBeEnabled();
    await expect(
      employee.getByRole("textbox", { name: "Colonia" })
    ).toBeEnabled();

    await postalCode.fill("01000");
    await expect(city).toHaveValue(SEPOMEX_AREAS["01000"].municipality);
    await expect(city).toBeDisabled();
    await employee.getByLabel("Colonia").click();
    await expect(employee.getByRole("option")).toHaveText(
      SEPOMEX_AREAS["01000"].suburbs
    );
    await employee.getByRole("option", { name: "San Ángel" }).click();
    await expect(employee.getByLabel("Colonia")).toContainText("San Ángel");
  } finally {
    await context.close();
  }
});
