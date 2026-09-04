import { expect, test } from '@playwright/test';

test('renders the HirePair landing page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('HirePair — Candidate Assistant & ATS CV Builder');
  await expect(page.getByRole('heading', { level: 1, name: 'HirePair Web' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(3);
});
