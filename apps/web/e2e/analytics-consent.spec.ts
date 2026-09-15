import { expect, test } from '@playwright/test';

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
  await page.getByRole('button', { name: 'Recusar' }).click();
  await expect(page.getByRole('button', { name: 'Preferências de privacidade' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Preferências de privacidade' })).toBeVisible();
  expect(postHogRequests).toBe(0);

  await page.getByRole('button', { name: 'Preferências de privacidade' }).click();
  await page.getByRole('button', { name: 'Aceitar' }).click();
  await expect.poll(() => postHogRequests).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Preferências de privacidade' }).click();
  await page.getByRole('button', { name: 'Recusar' }).click();
  await expect(page.getByRole('button', { name: 'Preferências de privacidade' })).toBeVisible();
});
