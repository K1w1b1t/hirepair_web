import { expect, test } from '@playwright/test';

test.describe('wizard acolhedor', () => {
  test('abre pela landing e se adapta ao celular', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('link', { name: 'Começar a conversa' }).click();

    await expect(page).toHaveURL(/\/conversa$/);
    await expect(page.getByRole('heading', { name: /vamos montar seu currículo/i })).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    await expect(page.getByRole('complementary')).toBeHidden();
    await page.getByRole('button', { name: 'Recusar' }).click();

    await page.getByRole('button', { name: /ver currículo/i }).click();
    await expect(page.getByRole('dialog', { name: /prévia do currículo/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /prévia do currículo/i })).toBeHidden();
  });

  test('mostra a conversa e a prévia lado a lado no desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/conversa');

    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('complementary')).toBeVisible();
    await expect(page.getByRole('button', { name: /ver currículo/i })).toBeHidden();
  });
});
