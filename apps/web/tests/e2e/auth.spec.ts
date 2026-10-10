import { expect, test } from "./fixtures";

test.describe("HR magic-link login", () => {
  test("known HR can authenticate through captured email and sign out", async ({
    app,
    page,
  }) => {
    await page.goto(`${app.baseURL}/dashboard`);
    await expect(page).toHaveURL(/\/login$/u);
    await expect(page.getByRole("heading", { name: "Horkos" })).toBeVisible();

    await page
      .getByLabel("Correo electrónico")
      .fill("VERIFICATION-HR@EXAMPLE.COM");
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(
      page.getByText(/Hemos enviado un enlace mágico/u)
    ).toBeVisible();

    await expect
      .poll(async () => {
        const messages = await app.getMail();

        return messages.length;
      })
      .toBe(1);
    const [message] = await app.getMail();
    expect(message.to).toBe("verification-hr@example.com");
    const magicLink = message.text.match(/https?:\/\/[^\s<>"']+/u)?.[0];

    if (!magicLink) {
      throw new Error("The captured email did not contain a login link");
    }

    await page.goto(magicLink);
    await expect(page).toHaveURL(/\/dashboard$/u);
    await expect(page.getByText("Invitaciones enviadas")).toBeVisible();
    expect(
      await app.db
        .prepare("SELECT count(*) AS count FROM session")
        .first("count")
    ).toBe(1);

    await page.getByRole("button", { name: "Menú de usuario" }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/u);
    expect(
      await app.db
        .prepare("SELECT count(*) AS count FROM session")
        .first("count")
    ).toBe(0);
    await page.goto(`${app.baseURL}/dashboard`);
    await expect(page).toHaveURL(/\/login$/u);
    await page.goto(`${app.baseURL}/invitaciones?tab=active&page=1`);
    await expect(page).toHaveURL(/\/login$/u);
  });
});

test("unknown HR receives the same confirmation without mail or verification records", async ({
  app,
  page,
}) => {
  await page.goto(`${app.baseURL}/invitaciones?tab=active&page=1`);
  await expect(page).toHaveURL(/\/login$/u);
  await page.getByLabel("Correo electrónico").fill("unknown@example.com");
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByText(/Hemos enviado un enlace mágico/u)).toBeVisible();
  expect(await app.getMail()).toHaveLength(0);
  expect(
    await app.db
      .prepare("SELECT count(*) AS count FROM verification")
      .first("count")
  ).toBe(0);
  expect(
    await app.db.prepare("SELECT count(*) AS count FROM session").first("count")
  ).toBe(0);
});
