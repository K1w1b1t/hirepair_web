import { expect, test } from '@playwright/test';

test.describe('wizard acolhedor', () => {
  test('abre pela landing e se adapta ao celular', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('link', { name: 'Começar a conversa' }).click();

    await expect(page).toHaveURL(/\/conversa$/);
    await expect(
      page.getByRole('heading', { name: /vamos começar pela sua jornada profissional/i }),
    ).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    await expect(page.getByRole('complementary')).toBeHidden();
    await page.getByRole('button', { name: 'Agora não' }).click();

    await page.getByRole('button', { name: /ver resumo/i }).click();
    await expect(page.getByRole('dialog', { name: /resumo dos materiais/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /resumo dos materiais/i })).toBeHidden();
  });

  test('mostra a conversa e a prévia lado a lado no desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/conversa');

    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('complementary')).toBeVisible();
    await expect(page.getByRole('button', { name: /ver resumo/i })).toBeHidden();
  });

  test('extrai um currículo PDF selecionado pelo usuário', async ({ page }) => {
    await page.goto('/conversa');

    await page.getByLabel('Enviar currículo').setInputFiles('e2e/fixtures/mock-resume.pdf');

    await expect(page.getByText('mock-resume.pdf').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Iniciar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar' })).toBeVisible();
    await expect(page.getByText('Gabriel Rodrigues')).toHaveCount(0);
    await expect(page.getByText('Engenheiro de software')).toHaveCount(0);
  });
});
