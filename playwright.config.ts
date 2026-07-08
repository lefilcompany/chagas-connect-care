import { defineConfig, devices } from "@playwright/test";
import { authStates } from "./tests/e2e/fixtures";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/e2e-junit.xml" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 12_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "public",
      testMatch: /public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "institutional",
      testMatch: /(institutional|data-access)\.spec\.ts/,
      dependencies: ["auth-setup"],
      use: { ...devices["Desktop Chrome"], storageState: authStates.adminA },
    },
    {
      name: "superadmin",
      testMatch: /superadmin\.spec\.ts/,
      dependencies: ["auth-setup"],
      use: { ...devices["Desktop Chrome"], storageState: authStates.superadmin },
    },
    {
      name: "legacy",
      testMatch: /legacy\.spec\.ts/,
      dependencies: ["auth-setup"],
      use: { ...devices["Desktop Chrome"], storageState: authStates.adminA },
    },
  ],
  webServer: {
    command: "npm run build:e2e && npm run preview:e2e",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
