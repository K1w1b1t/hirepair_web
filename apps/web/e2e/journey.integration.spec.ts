import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { expectCookieAtViewportCorner } from './helpers/viewport-evidence';

for (const withResume of [true, false]) {
  test(`HTTP real: ${withResume ? 'currículo ruim' : 'sem currículo e sem áudio'} até PDF e biblioteca`, async ({
    page,
  }, testInfo) => {
    if (!withResume) {
      await page.setViewportSize({ width: 390, height: 844 });
      // The previous scenario's writing reservation shares the provider minute window.
      await page.waitForTimeout(61_000);
    }
    await page.addInitScript(() => {
      Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
      Object.defineProperty(window, 'webkitSpeechRecognition', {
        value: undefined,
        configurable: true,
      });
    });
    // Only the external Turnstile widget is controlled. No /guest/* API is intercepted.
    await page.route(
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
      (route) =>
        route.fulfill({
          contentType: 'application/javascript',
          body: "window.turnstile={render:function(el,o){setTimeout(function(){o.callback('synthetic-proof')},0);return 'widget'},remove:function(){}}",
        }),
    );
    const statuses: number[] = [];
    let providerStage = 0;
    page.on('response', (response) => {
      if (response.url().includes(':3101/guest/') && response.request().method() === 'POST')
        statuses.push(response.status());
    });
    await page.goto('/conversa');
    await page.getByRole('button', { name: 'Agora não' }).click();
    if (withResume) {
      await page
        .getByLabel('Colar o texto')
        .fill('atendete feira azul 2024 ate hj separo pedido atendo cliente');
      await page.getByRole('button', { name: 'Adicionar material' }).click();
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    } else await page.getByRole('button', { name: 'Começar sem currículo' }).click();
    await page.getByLabel('Seu objetivo pessoal').selectOption('ENTER_FAST');
    await page.getByLabel(/requisitos da vaga/i).fill('Atendimento ao público');
    await page.getByRole('checkbox').check();
    await expect(page.getByRole('button', { name: /analisar e sugerir/i })).toBeEnabled();
    await page.getByRole('button', { name: /analisar e sugerir/i }).click();
    await expect(page.getByLabel('Sua resposta', { exact: true })).toBeVisible({ timeout: 30_000 });
    // Actual central reservations allow only 6,000 tokens/minute. Respect that window rather than weakening it for E2E.
    if (withResume) await page.waitForTimeout(61_000);
    for (let i = 0; i < 12; i++) {
      if (await page.getByRole('button', { name: 'Preparar meu currículo' }).isVisible()) break;
      const q = await page.getByRole('heading', { level: 1 }).innerText();
      const answer = /primeira experiência profissional/.test(q)
        ? 'Atualmente trabalho na Feira Azul desde 2024. Eu separo pedidos e atendo clientes.'
        : /período/.test(q)
          ? 'Desde 2024.'
          : /lugar/.test(q)
            ? 'Na Feira Azul do bairro.'
            : /ferramentas/.test(q)
              ? 'Uso um caderno para anotar pedidos.'
              : /frequência/.test(q)
                ? 'Todos os dias.'
                : /dificuldade/.test(q)
                  ? 'Quando falta produto, confiro a lista e aviso o cliente.'
                  : /aconteceu depois/.test(q)
                    ? 'O cliente fica sabendo do produto que está faltando.'
                    : 'Eu separo pedidos e atendo os clientes.';
      const before = statuses.length;
      await page.getByLabel('Sua resposta', { exact: true }).fill(answer);
      await page.getByRole('button', { name: 'Enviar resposta' }).click();
      await expect(page.getByText(`${i + 1} respostas recebidas`)).toBeVisible();
      await expect(page.getByText('Organizando sua resposta…')).toHaveCount(0, { timeout: 30_000 });
      if (statuses.length > before) {
        providerStage++;
        await page.waitForTimeout(61_000);
      }
      if (i === 0) {
        await page.reload();
        await expect(page.getByText('1 respostas recebidas')).toBeVisible();
      }
    }
    await expect(page.getByRole('button', { name: 'Preparar meu currículo' })).toBeVisible();
    await page.waitForTimeout(61_000);
    await page.getByRole('button', { name: 'Preparar meu currículo' }).click();
    await expect(page.getByRole('button', { name: 'Editar nome e contatos' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Editar nome e contatos' }).click();
    await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Pessoa Sintética');
    await page.getByRole('textbox', { name: 'Título profissional', exact: true }).fill('Atendente');
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('sintetica@example.com');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await page.getByRole('button', { name: 'Editar Experiência profissional' }).click();
    await page
      .getByRole('textbox', { name: 'Conteúdo', exact: true })
      .fill('Atende clientes e organiza pedidos na Feira Azul.');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(
      page.getByRole('button', { name: 'Aprovar currículo', exact: true }),
    ).toBeEnabled();
    await expectCookieAtViewportCorner(page);
    await page.screenshot({ path: testInfo.outputPath('review.png'), fullPage: false });
    await page.getByRole('button', { name: 'Aprovar currículo', exact: true }).click();
    await page.waitForURL(/meus-curriculos\/[^/]+$/);
    await expect(page.locator('.pdf-pages canvas[data-rendered=true]')).toHaveCount(1);
    await expectCookieAtViewportCorner(page);
    await page.screenshot({ path: testInfo.outputPath('approved.png'), fullPage: false });
    const downloading = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Baixar PDF' }).click();
    const bytes = new Uint8Array(await readFile((await (await downloading).path())!));
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await getDocument({ data: bytes.slice(), useSystemFonts: true }).promise;
    expect(pdf.numPages).toBe(1);
    const text = (await (await pdf.getPage(1)).getTextContent()).items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    expect(text).toContain('Pessoa Sintética');
    expect(text).toContain('Atende clientes e organiza pedidos na Feira Azul.');
    expect(text).not.toMatch(/SAP|900%/);
    await page.reload();
    await page.getByRole('link', { name: 'Meus currículos', exact: true }).click();
    await page
      .getByRole('link', { name: /Atendente/ })
      .first()
      .click();
    const again = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Baixar PDF' }).click();
    const saved = await readFile((await (await again).path())!);
    expect(createHash('sha256').update(saved).digest('hex')).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
    expect(statuses.every((status) => status === 201)).toBe(true);
    expect(providerStage).toBeGreaterThan(0);
  });
}
