import { expect, test } from '@playwright/test';

for (const decision of ['denied', 'granted']) {
  test(`não renderiza o modal ao navegar da home com consentimento ${decision}`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: 'analytics_consent', value: decision, url: 'http://127.0.0.1:3000' },
    ]);
    await page.route(/posthog\.com/, (route) => route.abort());
    const response = await page.goto('/');
    expect(await response!.text()).not.toContain('class="analytics-consent__dialog"');
    await expect(page.getByRole('button', { name: 'Preferências de cookies' })).toBeVisible();
    await page.getByRole('link', { name: 'Começar a conversa' }).click();
    await expect(page).toHaveURL(/\/conversa/);
    await expect(page.locator('.analytics-consent__dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Preferências de cookies' })).toBeVisible();
  });
}

test('persiste recusa, permite revogação e não contacta PostHog antes do opt-in', async ({
  page,
}) => {
  let postHogRequests = 0;
  await page.route(/posthog\.com/, async (route) => {
    postHogRequests += 1;
    await route.abort();
  });
  await page.goto('/conversa?email=private@example.com');
  expect(postHogRequests).toBe(0);
  await page.getByRole('button', { name: 'Agora não' }).click();
  await expect(page.getByRole('button', { name: 'Preferências de cookies' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Preferências de cookies' })).toBeVisible();
  expect(postHogRequests).toBe(0);

  await page.getByRole('button', { name: 'Preferências de cookies' }).click();
  await page.getByRole('button', { name: 'Aceito' }).click();
  await expect.poll(() => postHogRequests).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Preferências de cookies' }).click();
  await page.getByRole('button', { name: 'Agora não' }).click();
  await expect(page.getByRole('button', { name: 'Preferências de cookies' })).toBeVisible();
});
