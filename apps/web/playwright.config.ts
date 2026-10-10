import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  outputDir: "./test-results/playwright",
  use: {
    browserName: "chromium",
    trace: "on",
    screenshot: "on",
    video: "off",
  },
});
