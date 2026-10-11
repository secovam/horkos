import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { CapturedMail, LocalApp } from "./runtime";

const EMPLOYEE_EMAIL = "employee@example.com";

export function mailLink(message: CapturedMail) {
  const link = message.text.match(/https?:\/\/[^\s<>"']+/u)?.[0];

  if (!link) {
    throw new Error("Captured mail has no link");
  }

  return link;
}

// goey-toast also copies the message into a transient screen-reader alert, so match the toast itself.
export function toastMessage(page: Page, text: string) {
  return page.getByRole("region", { name: /Notifications/u }).getByText(text);
}

export async function login(app: LocalApp, page: Page) {
  await page.goto(`${app.baseURL}/login`);
  await page
    .getByLabel("Correo electrónico")
    .fill("verification-hr@example.com");
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByText(/Hemos enviado un enlace mágico/u)).toContainText(
    "Hemos enviado un enlace mágico"
  );
  await expect
    .poll(async () => {
      const messages = await app.getMail();

      return messages.length;
    })
    .toBe(1);
  const messages = await app.getMail();
  await page.goto(mailLink(messages[0]));
  await expect(page).toHaveURL(/\/dashboard$/u);
}

export async function invite(
  page: Page,
  name = "Verification Employee",
  email = EMPLOYEE_EMAIL
) {
  await page.getByRole("button", { name: "Nueva invitación" }).first().click();
  await page.getByLabel("Nombre del empleado").fill(name);
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Enviar invitación", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("row").filter({ hasText: email.toLowerCase() })
  ).toBeVisible();
}

export async function invitationLink(app: LocalApp, count: number) {
  await expect
    .poll(async () => {
      const messages = await app.getMail();

      return messages.filter((message) => message.to === EMPLOYEE_EMAIL).length;
    })
    .toBe(count);
  const messages = await app.getMail();

  return mailLink(
    messages.filter((message) => message.to === EMPLOYEE_EMAIL)[count - 1]
  );
}

export async function confirmAction(
  page: Page,
  action: "Reenviar" | "Revocar" | "Reactivar",
  name = "Verification Employee"
) {
  await page
    .getByRole("button", { name: `${action}: ${name}`, exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: action, exact: true })
    .click();
}
