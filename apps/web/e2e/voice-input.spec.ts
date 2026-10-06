import { expect, test } from '@playwright/test';

test('mantém o campo vazio compacto e expande texto longo com rolagem', async ({ page }) => {
  await page.goto('/conversa');
  await page.getByRole('button', { name: 'Agora não' }).click();
  const field = page.locator('#resume-paste');
  const emptyHeight = await field.evaluate((element) => element.clientHeight);
  expect(emptyHeight).toBeLessThanOrEqual(66);
  await field.fill(
    'Experiência profissional com atendimento e organização de estoque.\n'.repeat(40),
  );
  const dimensions = await field.evaluate((element) => ({
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(dimensions.height).toBeGreaterThan(emptyHeight);
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.height);
});

test('preenche currículo, vaga e cargo por ditado dentro das etapas atuais', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    class BrowserRecognition {
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onresult:
        | ((event: {
            resultIndex: number;
            results: Array<{ isFinal: boolean; 0: { transcript: string } }>;
          }) => void)
        | null = null;
      constructor() {
        Object.defineProperty(window, 'testRecognition', { configurable: true, value: this });
      }
      start() {
        this.onstart?.();
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: BrowserRecognition,
    });
  });
  async function speak(text: string) {
    await page.getByRole('button', { name: 'Falar para preencher' }).click();
    await expect(page.getByRole('status')).toHaveText('Pode falar.');
    await expect(page.locator('.voice-input-transcript')).toBeEmpty();
    await expect(page.locator('.voice-input-transcript')).toHaveCSS('height', '64px');
    const partial = text.split(' ').slice(0, 2).join(' ');
    await page.evaluate((transcript) => {
      const browser = window as unknown as Window & {
        testRecognition: {
          onresult: (event: {
            resultIndex: number;
            results: Array<{ isFinal: boolean; 0: { transcript: string } }>;
          }) => void;
        };
      };
      browser.testRecognition.onresult({
        resultIndex: 0,
        results: [{ isFinal: false, 0: { transcript } }],
      });
    }, partial);
    await expect(page.locator('.voice-input-transcript')).toHaveText(partial);
    await page.evaluate((transcript) => {
      const browser = window as unknown as Window & {
        testRecognition: {
          onresult: (event: {
            resultIndex: number;
            results: Array<{ isFinal: boolean; 0: { transcript: string } }>;
          }) => void;
        };
      };
      browser.testRecognition.onresult({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript } }],
      });
    }, text);
    await expect(page.locator('.voice-input-transcript')).toHaveText(text);
  }
  await page.goto('/conversa');
  await page.getByRole('button', { name: 'Agora não' }).click();
  await page.getByLabel('Colar o texto do currículo').fill('Atendimento ao cliente.');
  await speak('Organização de estoque.');
  await expect(page.locator('#resume-paste')).toHaveCount(0);
  await expect(page.locator('.voice-input-header')).toBeVisible();
  await expect(page.locator('.voice-input-transcript')).toBeVisible();
  await expect(page.locator('.voice-input-transcript')).toHaveText('Organização de estoque.');
  await expect(page.getByRole('button', { name: 'Confirmar ditado' })).toBeEnabled();
  const mobileEvidence = testInfo.outputPath('dictation-resume-mobile.png');
  await page.locator('.voice-input-transcript').scrollIntoViewIfNeeded();
  await page.screenshot({ path: mobileEvidence });
  await testInfo.attach('Ditado no currículo — celular', {
    path: mobileEvidence,
    contentType: 'image/png',
  });
  await expect(page.getByRole('button', { name: 'Adicionar material' })).toBeDisabled();
  await page.getByRole('button', { name: 'Confirmar ditado' }).click();
  await expect(page.locator('#resume-paste')).toHaveValue(
    'Atendimento ao cliente. Organização de estoque.',
  );
  await page.getByRole('button', { name: 'Adicionar material' }).click();
  await page.getByRole('button', { name: 'Ver resumo' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await speak('Experiência em logística.');
  await page.getByRole('button', { name: 'Confirmar ditado' }).click();
  await expect(page.locator('#job-text')).toHaveValue('Experiência em logística.');
  await page.getByRole('button', { name: 'Ainda não tenho' }).click();
  await speak('Auxiliar de logística');
  await page.getByRole('button', { name: 'Confirmar ditado' }).click();
  await expect(page.locator('#target-role')).toHaveValue('Auxiliar de logística');
  await expect(page).toHaveURL(/\/conversa\?etapa=job$/);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  await expect(page.getByRole('button', { name: /analisar e sugerir/i })).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: /analisar e sugerir/i })).toBeEnabled();
  await page.setViewportSize({ width: 1280, height: 800 });
  const desktopEvidence = testInfo.outputPath('dictation-role-desktop.png');
  await page.screenshot({ path: desktopEvidence, fullPage: true });
  await testInfo.attach('Cargo por voz — desktop', {
    path: desktopEvidence,
    contentType: 'image/png',
  });
});

test('continua digitando quando o navegador não oferece ditado', async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
      Object.defineProperty(window, name, { configurable: true, value: undefined });
    }
  });
  await page.goto('/conversa');
  await page.getByRole('button', { name: 'Agora não' }).click();
  await expect(page.getByRole('button', { name: 'Falar para preencher' })).toBeHidden();
  await expect(page.getByText(/áudio pode ser processado/i)).toHaveCount(0);
  await page.getByLabel('Colar o texto do currículo').fill('Atendimento ao cliente.');
  await page.getByRole('button', { name: 'Adicionar material' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Requisitos da vaga').fill('Vaga de atendimento.');
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: /analisar e sugerir/i })).toBeEnabled();
});
