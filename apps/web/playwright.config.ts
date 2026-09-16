import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_test_e2e',
      NEXT_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
      NEXT_PUBLIC_APP_ENV: 'development',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
