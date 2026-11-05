import { expect, test } from '@playwright/test';
import { mockGuestChallenge } from './helpers/guest-challenge';
import { seedReview } from './helpers/seed-review';
test.beforeEach(async ({ page }) => {
  await mockGuestChallenge(page);
});
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
const evidence = resolve(__dirname, '../../../docs/backend/evidence/20');
test('aprova, baixa o PDF exato e reabre pela biblioteca', async ({ page }) => {
  await seedReview(page);
  await expect(page.getByRole('heading', { name: 'Confira seu currículo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprovar currículo', exact: true })).toBeEnabled();
  await expect(page.locator('.pdf-pages')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar Experiência profissional' })).toBeVisible();
  await page.screenshot({ path: `${evidence}/review-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Aprovar currículo', exact: true }).click();
  await page.waitForURL(/\/meus-curriculos\/[^/]+$/);
  await expect(page.getByRole('heading', { name: 'Currículo aprovado' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Baixar PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('curriculo-Atendente.pdf');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = new Uint8Array(await readFile((await download.path())!));
  const downloadedHash = createHash('sha256').update(bytes).digest('hex');
  const loadingTask = getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  expect(pdf.numPages).toBe(1);
  const text = (await (await pdf.getPage(1)).getTextContent()).items
    .map((item) => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  expect(text).toContain('Ana Exemplo Sintética');
  expect(text).toContain('São Paulo, 2024–2026.');
  expect(text.indexOf('Experiência 1')).toBeLessThan(text.indexOf('Experiência 2'));
  await loadingTask.destroy();
  await expect(page.locator('.pdf-pages canvas[data-rendered=true]')).toHaveCount(1);
  await expect(page.locator('.library-content details')).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Versão textual do currículo' })).toHaveClass(
    'sr-only',
  );
  await page.screenshot({ path: `${evidence}/approved-desktop.png`, fullPage: false });
  await page.getByRole('link', { name: 'Voltar para home' }).click();
  await expect(page).toHaveURL('/');
  await page.screenshot({ path: `${evidence}/home-desktop.png`, fullPage: false });
  await page.getByRole('link', { name: 'Meus currículos' }).click();
  await expect(page.getByRole('link', { name: /Atendente Aprovado/ })).toBeVisible();
  await page.screenshot({ path: `${evidence}/library-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${evidence}/library-mobile.png`, fullPage: true });
  await page.getByRole('link', { name: /Atendente Aprovado/ }).click();
  await expect(page.getByRole('link', { name: 'Baixar PDF' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Baixar PDF' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const reopened = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Baixar PDF' }).click();
  const sameFile = await reopened;
  expect(
    createHash('sha256')
      .update(await readFile((await sameFile.path())!))
      .digest('hex'),
  ).toBe(downloadedHash);
  await expect(page.locator('.pdf-pages canvas[data-rendered=true]')).toHaveCount(1);
  await page.screenshot({ path: `${evidence}/approved-mobile.png`, fullPage: false });
});
test('estado vazio, retomada e descarte confirmado', async ({ page, context }) => {
  await page.goto('/meus-curriculos');
  await page.getByRole('button', { name: 'Agora não' }).click();
  await expect(page.getByText('Seu próximo passo começa com um currículo')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${evidence}/empty-mobile.png`, fullPage: true });
  await page.getByRole('link', { name: 'Criar meu currículo' }).click();
  await page.getByRole('button', { name: 'Começar sem currículo' }).click();
  await page.reload();
  await expect(page).toHaveURL(/etapa=job/);
  const another = await context.newPage();
  await mockGuestChallenge(another);
  await another.setViewportSize({ width: 390, height: 844 });
  await another.goto('/');
  await expect(another).toHaveURL(/conversa.*etapa=job/);
  await expect(another.getByRole('link', { name: 'Voltar para o início' })).toBeVisible();
  await another.getByRole('link', { name: 'Voltar para o início' }).focus();
  await another.keyboard.press('Enter');
  await expect(another.getByRole('dialog')).toBeVisible();
  await expect(another.getByRole('button', { name: 'Continuar criando' })).toBeFocused();
  await another.screenshot({ path: `${evidence}/discard-mobile.png`, fullPage: true });
  await another.keyboard.press('Escape');
  await expect(another.getByRole('dialog')).not.toBeVisible();
  await expect(another.getByRole('link', { name: 'Voltar para o início' })).toBeFocused();
  await another.getByRole('link', { name: 'Voltar para o início' }).click();
  await another.getByRole('button', { name: 'Sair e descartar' }).click();
  await expect(another).toHaveURL('/');
  await another.reload();
  await expect(another).toHaveURL('/');
});
test('duas páginas preservam todas as palavras e excesso retorna pendência', async ({ page }) => {
  const longName =
    'Ana Exemplo Sintética de Albuquerque dos Santos Oliveira Costa Ferreira de Souza e Silva';
  await seedReview(page, 'E_SPECIALIST', 48, longName);
  await expect(page.getByRole('button', { name: 'Aprovar currículo', exact: true })).toBeEnabled();
  await expect(page.locator('.pdf-pages')).toHaveCount(0);
  await page.getByRole('button', { name: 'Aprovar currículo', exact: true }).click();
  await page.waitForURL(/\/meus-curriculos\/[^/]+$/);
  const waiting = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Baixar PDF' }).click();
  const file = await waiting;
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(await readFile((await file.path())!)) });
  const doc = await task.promise;
  expect(doc.numPages).toBe(2);
  let text = '';
  for (let n = 1; n <= 2; n++)
    text +=
      (await (await doc.getPage(n)).getTextContent()).items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ') + ' ';
  text = text.replace(/\s+/g, ' ').trim();
  const expected = [
    longName,
    'Atendente',
    'ana@example.com',
    'EXPERIÊNCIA PROFISSIONAL',
    ...Array.from(
      { length: 48 },
      (_, i) =>
        `Atendeu clientes com atenção e organização. Experiência ${i + 1} — São Paulo, 2024–2026. https://example.com/projeto`,
    ),
  ].join(' ');
  expect(text).toBe(expected);
  await task.destroy();
  await expect(page.locator('.pdf-pages canvas[data-rendered=true]')).toHaveCount(2);
  await page.screenshot({ path: `${evidence}/two-pages-desktop.png`, fullPage: true });
  await seedReview(page, 'A_FIRST_JOB', 48);
  await expect(page.locator('.resume-review').getByRole('alert')).toContainText(
    'ultrapassou o limite de 1 página',
  );
  await expect(page.getByRole('button', { name: 'Aprovar currículo', exact: true })).toBeDisabled();
});
test('voltar do navegador para home pede confirmação sem perder o progresso', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Agora não' }).click();
  await page.getByRole('link', { name: 'Começar a conversa' }).click();
  await page.getByRole('button', { name: 'Começar sem currículo' }).click();
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar criando' }).click();
  await expect(page).toHaveURL(/conversa.*etapa=job/);
  await page.reload();
  await expect(page).toHaveURL(/etapa=job/);
});
