import type { Page } from '@playwright/test';

export async function mockGuestChallenge(page: Page) {
  await page.route('**/guest/config', async (route) => {
    await route.fulfill({
      json: {
        enabled: true,
        siteKey: 'test-site',
        termsVersion: '2026-10-07',
        privacyVersion: '2026-10-07',
      },
    });
  });
  await page.route(
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: "window.turnstile={render:function(el,options){setTimeout(function(){options.callback('test-proof')},0);return 'test-widget'},remove:function(){}};",
      });
    },
  );
}
