import { test as base, expect } from "@playwright/test";

import { createLocalApp } from "./runtime";
import type { LocalApp } from "./runtime";

export const test = base.extend<{ app: LocalApp }>({
  app: async ({ page }, runTest) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const app = await createLocalApp();

    try {
      const health = await page.request.get(`${app.baseURL}/login`);
      expect(health.status()).toBe(200);
      expect(await health.text()).toContain("Correo electrónico");
      await runTest(app);
    } finally {
      await app.close();
    }
  },
});

export { expect } from "@playwright/test";
