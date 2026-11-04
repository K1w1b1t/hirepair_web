import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/journey.integration.spec.ts',
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 420_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/integration', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    actionTimeout: 10000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm exec -w @hirepair/api -- ts-node test/journey-stack.ts',
      url: 'http://127.0.0.1:3101/guest/config',
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run build && npm run start -- --port 3100',
      url: 'http://127.0.0.1:3100',
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3101',
        NEXT_TELEMETRY_DISABLED: '1',
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: '',
        NEXT_PUBLIC_APP_ENV: 'development',
      },
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
