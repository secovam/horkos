import type { Locator, Page } from "@playwright/test";

import { confirmAction, invitationLink, invite, login } from "./actions";
import { expect, test } from "./fixtures";
import type { LocalApp } from "./runtime";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

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

const VALID_TAX_STATUS = {
  name: "constancia.pdf",
  mimeType: "application/pdf",
  buffer: PDF,
};

async function attachDocuments(page: Page, taxStatus = VALID_TAX_STATUS) {
  await page
    .getByLabel("Constancia de situación fiscal")
    .setInputFiles(taxStatus);
  await page.getByLabel("Constancia del IMSS (NSS)").setInputFiles({
    name: "imss.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });
  await page.getByLabel("Comprobante de domicilio").setInputFiles({
    name: "domicilio.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });
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

test.beforeEach(async ({ app, page }) => {
  await login(app, page);
  await page.getByRole("link", { name: "Invitaciones", exact: true }).click();
  await invite(page);
});

test("employee submits documents and data from a computer; HR sees it received", async ({
  app,
  page,
  browser,
}) => {
  const link = await invitationLink(app, 1);

  const employee = await browser.newContext({
    viewport: DESKTOP,
  });

  try {
    const desktop = await employee.newPage();
    await desktop.goto(link);
    await expect(
      desktop.getByRole("heading", { name: "Completa tu información" })
    ).toBeVisible();
    await dismissTour(desktop);
    await expect(desktop.getByLabel("Nombre completo")).toHaveValue(
      "Verification Employee"
    );

    await desktop
      .getByRole("button", { name: "Enviar mi información" })
      .click();
    await expect(
      desktop.getByText("Sube este documento.").first()
    ).toBeVisible();
    await expect(
      desktop.getByText("El código postal tiene 5 dígitos.")
    ).toBeVisible();
    expect(await count(app, "submission")).toBe(0);

    await fillFields(desktop);

    for (const rejected of [
      {
        name: "constancia.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("<script>not a pdf</script>"),
      },
      { name: "constancia.png", mimeType: "image/png", buffer: PNG },
    ]) {
      // oxlint-disable-next-line no-await-in-loop -- Each rejection is checked before the next attempt.
      await attachDocuments(desktop, rejected);
      // oxlint-disable-next-line no-await-in-loop -- Each rejection is checked before the next attempt.
      await desktop
        .getByRole("button", { name: "Enviar mi información" })
        .click();
      // oxlint-disable-next-line no-await-in-loop -- Each rejection is checked before the next attempt.
      await expect(
        desktop.getByRole("alert").filter({
          hasText: "Constancia de situación fiscal: sube un archivo PDF.",
        })
      ).toBeVisible();
      // oxlint-disable-next-line no-await-in-loop -- Each rejection is checked before the next attempt.
      expect(await count(app, "submission")).toBe(0);
      // oxlint-disable-next-line no-await-in-loop -- Each rejection is checked before the next attempt.
      expect(await app.listObjects()).toHaveLength(0);
    }

    await attachDocuments(desktop);
    await expect(desktop.getByLabel("RFC", { exact: true })).toHaveValue(
      "xaxx010101ab1"
    );
    await desktop.screenshot({
      path: test.info().outputPath("form-filled.png"),
      fullPage: true,
    });
    await desktop
      .getByRole("button", { name: "Enviar mi información" })
      .click();
    await expect(
      desktop.getByRole("heading", { name: "Recibimos tu información" })
    ).toBeVisible();
    await desktop.screenshot({
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
        content_type: "application/pdf",
      },
      {
        kind: "proof_of_address",
        object_key: `invitations/${invitationId}/employee/proof_of_address`,
        content_type: "application/pdf",
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

    await desktop.reload();
    await expect(
      desktop.getByRole("heading", { name: "Recibimos tu información" })
    ).toBeVisible();
    await expect(desktop.getByLabel("RFC", { exact: true })).toBeHidden();

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
    viewport: DESKTOP,
  });

  try {
    const desktop = await employee.newPage();
    await desktop.goto(link);
    await expect(
      desktop.getByRole("heading", { name: "Completa tu información" })
    ).toBeVisible();
    await dismissTour(desktop);
    await fillFields(desktop);
    await attachDocuments(desktop);

    await confirmAction(page, "Revocar");
    await expect(
      page.getByRole("button", { name: "Revocar: Verification Employee" })
    ).toBeHidden();

    await desktop
      .getByRole("button", { name: "Enviar mi información" })
      .click();
    await expect(
      desktop.getByRole("alert").filter({
        hasText:
          "Este enlace ya no está disponible. Pide uno nuevo a Recursos Humanos.",
      })
    ).toBeVisible();
    expect(await count(app, "submission")).toBe(0);
    expect(await count(app, "document")).toBe(0);
    expect(await app.listObjects()).toHaveLength(0);

    await desktop.reload();
    await expect(
      desktop.getByRole("heading", { name: "Este enlace no está disponible" })
    ).toBeVisible();
  } finally {
    await employee.close();
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
    await expect(popover).toContainText("1 de 5");
    await expectOnScreen(popover);
    await desktop.screenshot({
      path: test.info().outputPath("tour-step-1.png"),
      animations: "disabled",
    });

    await popover.getByRole("button", { name: "Siguiente" }).click();
    await expect(popover).toContainText("Documentos");
    await expect(popover).toContainText("2 de 5");
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

    for (const title of ["Datos personales", "Domicilio", "Enviar"]) {
      // oxlint-disable-next-line no-await-in-loop -- Steps are walked in order like a person would.
      await popover.getByRole("button", { name: /Siguiente|Listo/u }).click();
      // oxlint-disable-next-line no-await-in-loop -- Each step is checked before moving on.
      await expect(popover).toContainText(title);
      // oxlint-disable-next-line no-await-in-loop -- Each step is checked before moving on.
      await expectOnScreen(popover);
    }

    await expect(popover).toContainText("5 de 5");
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
    await expect(popover).toContainText("1 de 5");
    await desktop.keyboard.press("Escape");
    await expect(popover).toBeHidden();

    await desktop.getByRole("button", { name: "¿Cómo lleno esto?" }).click();
    await expect(popover).toContainText("1 de 5");
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
    await expect(popover).toContainText("1 de 5");

    for (const [step, anchor] of [
      [2, "documents"],
      [3, "personal"],
      [4, "address"],
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop -- Steps are walked in order like a person would.
      await popover.getByRole("button", { name: "Siguiente" }).click();
      // oxlint-disable-next-line no-await-in-loop -- Each step is checked before moving on.
      await expect(popover).toContainText(`${step} de 5`);
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
