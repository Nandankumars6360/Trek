import { defineConfig, devices } from '@playwright/test';

// End-to-end tests. They need the app running against a database you can reset
// (see tests/e2e/README.md). Never point them at production.
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless=new', '--disable-gpu'] }
      : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
