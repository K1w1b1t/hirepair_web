import { expect, test } from '@playwright/test';

test('renders the HirePair landing page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('HirePair | Currículos claros para novas oportunidades');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Um currículo claro para abrir portas.' }),
  ).toBeVisible();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(
    page.getByRole('link', { name: /conversar pelo whatsapp/i }).first(),
  ).toHaveAttribute('href', /wa\.me\/551191365266/);
});
