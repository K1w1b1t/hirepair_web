import { expect, test } from '@playwright/test';

test.describe('wizard acolhedor', () => {
  async function dismissAnalytics(page: import('@playwright/test').Page) {
    const dismissButton = page.getByRole('button', { name: 'Agora não' });
    await dismissButton.waitFor({ state: 'visible' });
    await dismissButton.click();
  }

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
    await dismissAnalytics(page);

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
    await dismissAnalytics(page);

    await page.getByLabel('Enviar currículo').setInputFiles('e2e/fixtures/mock-resume.pdf');

    await expect(page.getByText('mock-resume.pdf').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pronto para continuar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
    await expect(page.getByText('Gabriel Rodrigues')).toHaveCount(0);
    await expect(page.getByText('Engenheiro de software')).toHaveCount(0);
  });

  test('separa vaga e recomendações em etapas claras', async ({ page }) => {
    await page.route('**/guest/access', async (route) => {
      await route.fulfill({ json: { accessToken: 'guest-token' }, status: 201 });
    });
    await page.route('**/guest/job-analysis', async (route) => {
      await route.fulfill({
        json: {
          reason: 'Seu histórico indica uma transição de carreira.',
          requirements: [{ category: 'ELIMINATORY', text: 'Graduação em Engenharia' }],
          suggestedArchetype: 'B_CAREER_CHANGE',
          suggestedObjective: 'CHANGE_FIELD',
          suggestedTone: 'CONSULTATIVE',
          summary: 'Encontramos 1 requisito principal para orientar seu currículo.',
          targetRole: 'Engenheiro mecânico',
        },
        status: 201,
      });
    });

    await page.goto('/conversa');
    await dismissAnalytics(page);
    await page.getByLabel('Colar o texto').fill('Mecânico de manutenção industrial.');
    await page.getByRole('button', { name: 'Adicionar material' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByText('Passo 2 de 5')).toBeVisible();
    await expect(page.getByRole('heading', { name: /qual vaga você quer buscar/i })).toBeVisible();
    await expect(page.getByText(/sugestões aparecerão aqui/i)).toBeVisible();
    await page.getByLabel(/requisitos da vaga/i).fill('Vaga para engenheiro mecânico.');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /analisar e sugerir/i }).click();

    await expect(page.getByText('Passo 3 de 5')).toBeVisible();
    await expect(page.getByRole('heading', { name: /sugerido para você/i })).toBeVisible();
    await expect(page.getByText('Engenheiro mecânico')).toBeVisible();
    await expect(page.getByRole('radio', { name: /transição de carreira/i })).toBeChecked();
    await expect(page.getByRole('button', { name: /continuar.*em breve/i })).toBeDisabled();
  });
});
