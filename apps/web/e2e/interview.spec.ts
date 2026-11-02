import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { preparationFixture } from '../test/preparation';
import { mockGuestChallenge } from './helpers/guest-challenge';
import type { InterviewBlockRequest } from '@hirepair/interview-engine';
async function setup(page: Page) {
  await mockGuestChallenge(page);
  await page.addInitScript(() => {
    class Utterance {
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: Utterance,
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: () => {},
        getVoices: () => [],
        speak: (u: Utterance) => setTimeout(() => u.onend?.(), 20),
      },
    });
  });
  await page.route('**/guest/access', (r) =>
    r.fulfill({ json: { accessToken: 'aa.bb' }, status: 201 }),
  );
  await page.route('**/guest/interview-preparation', (r) =>
    r.fulfill({ json: preparationFixture(r.request().postDataJSON()), status: 201 }),
  );
  await page.route('**/guest/interview-block', async (route) => {
    const request = route.request().postDataJSON() as InterviewBlockRequest,
      t = request.turns[0],
      origin = {
        sourceId: t.id,
        sourceVersion: createHash('sha256').update(t.text).digest('hex'),
        quote: t.text,
      };
    await route.fulfill({
      status: 201,
      json: {
        version: 1,
        revision: request.revision,
        extraction: {
          experiences: request.context.experiences.length
            ? []
            : [
                {
                  id: 'synthetic-exp',
                  title: 'Feira escolar',
                  start: null,
                  end: null,
                  current: null,
                  origin,
                },
              ],
          facts: [{ id: `fact-${t.id}`, experienceId: 'synthetic-exp', text: t.text, origin }],
        },
        analysis: null,
        assessments: request.topics.map((topic) => ({
          topicId: topic.id,
          sufficient: true,
          evidence: [],
          question: null,
          contradictionFactIds: [],
        })),
      },
    });
  });
}
async function begin(page: Page, withResume: boolean) {
  await page.goto('/conversa');
  await page.getByRole('button', { name: 'Agora não' }).click();
  if (withResume) {
    await page.getByLabel('Colar o texto').fill('Organizei inscrições na escola.');
    await page.getByRole('button', { name: 'Adicionar material' }).click();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  } else await page.getByText('Começar sem currículo').click();
  await page.getByLabel('Seu objetivo pessoal').selectOption('ENTER_FAST');
  await page.getByLabel(/requisitos da vaga/i).fill('Atendimento ao público');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /analisar e sugerir/i }).click();
  await expect(page.getByRole('progressbar', { name: 'Progresso da entrevista' })).toBeVisible();
}
for (const withResume of [false, true])
  test(`entrevista guiada ${withResume ? 'com' : 'sem'} currículo termina sem conferência`, async ({
    page,
  }) => {
    await setup(page);
    if (!withResume) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(() => {
        Object.defineProperty(window, 'SpeechRecognition', {
          value: undefined,
          configurable: true,
        });
        Object.defineProperty(window, 'webkitSpeechRecognition', {
          value: undefined,
          configurable: true,
        });
      });
    }
    await begin(page, withResume);
    await expect(page.getByRole('button')).toHaveCount(2);
    await page.screenshot({
      path: `../../docs/backend/evidence/15-guided-${withResume ? 'desktop' : 'mobile-text'}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    for (let i = 0; i < 8; i++) {
      if (await page.getByText('Entrevista concluída', { exact: true }).isVisible()) break;
      await page
        .getByLabel('Sua resposta', { exact: true })
        .fill(`Eu conferia as inscrições de cada participante da feira ${i}.`);
      await page.getByRole('button', { name: 'Enviar resposta' }).click();
      await expect(page.getByText('Organizando sua resposta…')).toHaveCount(0);
      await expect(
        page
          .getByRole('button', { name: 'Enviar resposta' })
          .or(page.getByText('Entrevista concluída', { exact: true })),
      ).toBeVisible();
    }
    await expect(page.getByText('Entrevista concluída', { exact: true })).toBeVisible();
    if (withResume)
      await page.screenshot({
        path: '../../docs/backend/evidence/15-guided-success.png',
        fullPage: true,
        animations: 'disabled',
      });
    await expect(page.getByText('O que você quer manter?')).toHaveCount(0);
    await expect(page.getByRole('button')).toHaveCount(0);
    await page.reload();
    await expect(page.getByText('Entrevista concluída', { exact: true })).toBeVisible();
  });
test('ditado envia após silêncio e pode ser corrigido antes do envio', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    class Recognition {
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      constructor() {
        Object.defineProperty(window, 'syntheticRecognition', { value: this, configurable: true });
      }
      start() {
        this.onstart?.();
      }
      abort() {}
      stop() {
        this.onend?.();
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: Recognition, configurable: true });
  });
  await begin(page, false);
  await expect(page.getByRole('button', { name: 'Ouvir e responder' })).toBeVisible();
  await page.screenshot({
    path: '../../docs/backend/evidence/15-guided-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Ouvir e responder' }).click();
  await page.evaluate(() => {
    (
      window as unknown as { syntheticRecognition: { onresult: (e: unknown) => void } }
    ).syntheticRecognition.onresult({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: 'Organizei vendas erradas' } }],
    });
  });
  await expect(page.getByText('Entendi. Enviando em 2 segundos…')).toBeVisible({ timeout: 5000 });
  await page.getByText('Escrever', { exact: true }).click();
  await page.getByLabel('Sua resposta').fill('Organizei inscrições na feira escolar.');
  await page.getByText('Enviar resposta', { exact: true }).click();
  await expect(page.getByText('1 respostas recebidas')).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(2);
  await page.getByText('Falar', { exact: true }).click();
  await page.getByRole('button', { name: 'Ouvir e responder' }).click();
  await page.evaluate(() => {
    (
      window as unknown as { syntheticRecognition: { onresult: (e: unknown) => void } }
    ).syntheticRecognition.onresult({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: 'Na escola do bairro.' } }],
    });
  });
  await expect(page.getByText('2 respostas recebidas')).toBeVisible({ timeout: 8000 });
});
