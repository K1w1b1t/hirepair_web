import { expect, test } from '@playwright/test';

// Synthetic fixtures only; this journey performs no provider call.
test('diagnoses, corrects and restores a document without blocking the journey', async ({
  page,
}) => {
  let guestCalls = 0;
  page.on('request', (request) => {
    if (/\/guest\//.test(request.url())) guestCalls++;
  });
  await page.goto('/conversa');
  await page.getByRole('button', { name: 'Agora não' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = page.getByRole('region', { name: 'Diagnóstico dos documentos' });
  await expect(panel.getByText(/Sem currículo para diagnosticar/)).toBeVisible();
  await page.getByLabel('Enviar currículo').setInputFiles({
    name: 'synthetic-resume.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      'Objetivo: trabalhar na Empresa Aurora\nCPF: 123.456.789-09\nExperiênciade atendimento atendimento.\nDomínio completo da operação.',
    ),
  });
  await expect(
    panel.getByRole('heading', { name: 'Documento dirigido a um destinatário específico' }),
  ).toBeVisible();
  const usage = panel.getByLabel(/Este currículo é o usado/);
  await expect(usage).toBeEnabled();
  await usage.selectOption('yes');
  await expect(usage).toBeEnabled();
  await expect(usage).toHaveValue('yes');
  await page.getByRole('button', { name: /ver resumo/i }).click();
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: '../../docs/design/web/evidence/task17-before-correction-mobile.png',
    fullPage: true,
  });
  await page.reload();
  await expect(panel.getByLabel(/Este currículo é o usado/)).toHaveValue('yes');
  await panel.getByText('Ver texto extraído', { exact: true }).click();
  await expect(panel.locator('pre')).toContainText('Experiênciade');
  await panel.getByText('Corrigir ou substituir o texto', { exact: true }).click();
  await panel
    .getByLabel('Texto do currículo de synthetic-resume.txt')
    .fill('Atendeu clientes e conferiu pedidos na loja.');
  await expect(panel.getByRole('button', { name: 'Salvar texto corrigido' })).toBeEnabled();
  await panel.getByRole('button', { name: 'Salvar texto corrigido' }).click();
  await expect(panel.getByText(/Nenhum achado nas regras aplicáveis/)).toBeVisible();
  await expect(
    panel.getByRole('heading', { name: 'Documento dirigido a um destinatário específico' }),
  ).toHaveCount(0);
  await expect(panel.getByLabel(/Este currículo é o usado/)).toHaveValue('unknown');
  const originalRetained = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('hirepair-resumes', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise<Array<{ original: File }>>((resolve, reject) => {
      const request = db.transaction('resumes', 'readonly').objectStore('resumes').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return records[0].original.text();
  });
  expect(originalRetained).toContain('Experiênciade');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: '../../docs/design/web/evidence/task17-after-correction-desktop.png',
    fullPage: true,
  });
  await page.reload();
  await expect(panel.getByText(/Nenhum achado nas regras aplicáveis/)).toBeVisible();
  await panel.getByLabel('Tipo de material de synthetic-resume.txt').selectOption('story');
  await expect(panel.getByText(/Sem currículo para diagnosticar/)).toBeVisible();
  await expect(panel.getByRole('list', { name: /Achados/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Remover synthetic-resume.txt' }).click();
  await expect(panel.getByRole('article')).toHaveCount(0);
  await page.reload();
  await expect(panel.getByText(/Sem currículo para diagnosticar/)).toBeVisible();
  expect(guestCalls).toBe(0);
});
