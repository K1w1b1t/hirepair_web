import { expect, test } from '@playwright/test';
import { preparationFixture } from '../test/preparation';
import { mockGuestChallenge } from './helpers/guest-challenge';

// Synthetic fixture: diagnosis enriches internal interview data, never a candidate-facing report.
test('prepares internal diagnostic topics without showing findings to the candidate', async ({
  page,
}) => {
  await mockGuestChallenge(page);
  await page.route('**/guest/access', (route) =>
    route.fulfill({ status: 201, json: { accessToken: 'guest-token' } }),
  );
  let preparationRequests = 0;
  await page.route('**/guest/interview-preparation', async (route) => {
    preparationRequests++;
    expect(route.request().postData()).not.toContain('123.456.789-09');
    await route.fulfill({ status: 201, json: preparationFixture(route.request().postDataJSON()) });
  });
  await page.goto('/conversa');
  await page.getByRole('button', { name: 'Agora não' }).click();
  await page.getByLabel('Enviar currículo').setInputFiles({
    name: 'synthetic-resume.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('CPF: 123.456.789-09\nDomínio completo da operação.'),
  });
  await expect(page.getByText('synthetic-resume.txt')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Seu objetivo pessoal').selectOption('ENTER_FAST');
  await page.getByLabel('Requisitos da vaga').fill('Atendimento ao cliente');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Analisar e sugerir' }).click();
  await expect(page.getByRole('heading', { name: 'Sugerido para você' })).toBeVisible();
  const internal = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('hirepair-interview', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const session = await new Promise<{
      diagnostics: Array<{ findings: Array<{ code: string }> }>;
      plan: { topics: Array<{ diagnosticFindingId?: string }> };
    }>((resolve, reject) => {
      const request = db.transaction('session', 'readonly').objectStore('session').get('active');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return {
      codes: session.diagnostics[0].findings.map((f) => f.code),
      hasDiagnosticTopic: session.plan.topics.some((t) => t.diagnosticFindingId),
    };
  });
  expect(internal.codes).toEqual(
    expect.arrayContaining(['UNNECESSARY_PERSONAL_DATA', 'SCOPE_NEEDS_SUPPORT']),
  );
  expect(internal.hasDiagnosticTopic).toBe(true);
  await expect(page.getByRole('region', { name: 'Diagnóstico dos documentos' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Plano inicial de investigação' })).toHaveCount(0);
  await expect(page.getByText('Dado pessoal desnecessário no documento')).toHaveCount(0);
  await expect(page.getByText('Declaração de escopo a esclarecer')).toHaveCount(0);
  expect(preparationRequests).toBe(1);
});
