import { expect, test } from '@playwright/test';

test('renders the HirePair landing page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('HirePair | Currículos claros para novas oportunidades');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Um currículo claro para abrir portas.' }),
  ).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Começar a conversa' })).toHaveAttribute(
    'href',
    '/conversa',
  );
  await expect(
    page.getByRole('link', { name: /conversar pelo whatsapp/i }).first(),
  ).toHaveAttribute('href', /wa\.me\/5511913165266/);
});

for (const width of [320, 768, 1440]) {
  test(`home mantém conteúdo acessível na largura ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Começar a conversa' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Meus currículos' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}
