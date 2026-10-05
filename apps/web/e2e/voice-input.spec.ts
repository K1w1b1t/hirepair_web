import { expect, test } from '@playwright/test';

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
    await expect(page.getByRole('status')).toHaveText('Ouvindo…');
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
  }
  await page.goto('/conversa');
  await page.getByRole('button', { name: 'Agora não' }).click();
  await page.getByLabel('Colar o texto do currículo').fill('Atendimento ao cliente.');
  await speak('Organização de estoque.');
  await expect(page.getByLabel('Colar o texto do currículo')).toHaveValue(
    'Atendimento ao cliente. Organização de estoque.',
  );
  await expect(page.getByRole('button', { name: 'Adicionar material' })).toBeDisabled();
  const mobileEvidence = testInfo.outputPath('dictation-resume-mobile.png');
  await page.getByLabel('Colar o texto do currículo').scrollIntoViewIfNeeded();
  await page.screenshot({ path: mobileEvidence });
  await testInfo.attach('Ditado no currículo — celular', {
    path: mobileEvidence,
    contentType: 'image/png',
  });
  await page.getByRole('button', { name: 'Parar ditado' }).click();
  await page.getByRole('button', { name: 'Adicionar material' }).click();
  await page.getByRole('button', { name: 'Ver resumo' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await speak('Experiência em logística.');
  await expect(page.getByLabel('Requisitos da vaga')).toHaveValue('Experiência em logística.');
  await expect(page.getByLabel('Requisitos da vaga')).toHaveCSS('padding-right', '64px');
  await page.getByRole('button', { name: 'Ainda não tenho' }).click();
  await speak('Auxiliar de logística');
  await page.getByRole('button', { name: 'Parar ditado' }).click();
  await expect(page.getByLabel('Cargo que procura')).toHaveValue('Auxiliar de logística');
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
  await expect(page.getByText(/áudio pode ser processado/i)).toBeHidden();
  await page.getByLabel('Colar o texto do currículo').fill('Atendimento ao cliente.');
  await page.getByRole('button', { name: 'Adicionar material' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Requisitos da vaga').fill('Vaga de atendimento.');
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: /analisar e sugerir/i })).toBeEnabled();
});
