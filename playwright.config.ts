import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests (e2e/). They run against a real Next.js server and a test database loaded with
 * the fixture from the manual test script (`npm run db:seed:test`, run by global-setup).
 *
 * Locally:  npm run build && E2E_PRODUCTION=true E2E_SERVER_COMMAND="npm run start" npm run test:e2e
 *           (plain `npm run test:e2e` starts `next dev`, where first-visit compiles can time tests out)
 * In CI:    the workflow builds first, and E2E_SERVER_COMMAND="npm run start".
 */
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] }, grep: /@phone/ },
  ],
  webServer: {
    command: process.env.E2E_SERVER_COMMAND ?? `npm run dev -- -p ${port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
