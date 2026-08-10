// The suite signs in with the seeded credentials, so it needs the same
// SEED_DEFAULT_PASSWORD the seed script used.
import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration.
 *
 * Playwright starts the application itself and reuses an already-running dev
 * server when there is one. The suite expects the development database to be
 * seeded (`npm run db:seed`).
 */

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // The dashboard is a desktop-first operations tool.
    viewport: { width: 1440, height: 900 },
  },

  /**
   * `channel: "chrome"` drives the locally installed Chrome rather than a
   * Playwright-managed build. Set E2E_USE_BUNDLED_BROWSER=1 on a machine where
   * `npx playwright install` has run to use the pinned browser instead.
   */
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.E2E_USE_BUNDLED_BROWSER === "1" ? {} : { channel: "chrome" }),
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        ...(process.env.E2E_USE_BUNDLED_BROWSER === "1" ? {} : { channel: "chrome" }),
      },
      testMatch: /responsive\.spec\.ts/,
    },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
