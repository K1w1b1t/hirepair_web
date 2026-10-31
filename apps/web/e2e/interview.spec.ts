import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { preparationFixture } from '../test/preparation';
import { mockGuestChallenge } from './helpers/guest-challenge';
import type { InterviewBlockRequest } from '@hirepair/interview-engine';
async function setup(page: Page) {
  await mockGuestChallenge(page);
  await page.route('**/guest/access', (route) =>
    route.fulfill({ json: { accessToken: 'aa.bb' }, status: 201 }),
  );
  await page.route('**/guest/interview-preparation', (route) =>
    route.fulfill({ json: preparationFixture(route.request().postDataJSON()), status: 201 }),
  );
  await page.route('**/guest/interview-block', async (route) => {
    const request = route.request().postDataJSON() as InterviewBlockRequest;
    const turn = request.turns[0];
    const origin = {
      sourceId: turn.id,
      sourceVersion: createHash('sha256').update(turn.text).digest('hex'),
      quote: turn.text,
    };
    await route.fulfill({
      status: 201,
      json: {
        version: 1,
        revision: request.revision,
        extraction: {
          experiences: [
            {
              id: 'synthetic-experience',
              title: 'Feira escolar · inscrições',
              start: null,
              end: null,
              current: null,
              origin,
            },
          ],
          facts: [
            { id: 'synthetic-fact', experienceId: 'synthetic-experience', text: turn.text, origin },
          ],
        },
        analysis: null,
        assessments: request.topics.map((topic) => ({
          topicId: topic.id,
          sufficient: true,
          evidence: ['atividade individual'],
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
    await page.getByLabel('Colar o texto').fill('Organizei inscrições de uma feira escolar.');
    await page.getByRole('button', { name: 'Adicionar material' }).click();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  } else await page.getByRole('button', { name: 'Começar sem currículo' }).click();
  await page.getByLabel('Seu objetivo pessoal').selectOption('ENTER_FAST');
  await page.getByLabel(/requisitos da vaga/i).fill('Atendimento ao público e organização.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /analisar e sugerir/i }).click();
  if (withResume) await page.getByRole('button', { name: 'Começar entrevista' }).click();
  await expect(page.getByRole('heading', { name: 'Uma experiência de cada vez' })).toBeVisible();
}
for (const withResume of [false, true]) {
  test(`entrevista, revisão, correção e confirmação ${withResume ? 'com' : 'sem'} currículo`, async ({
    page,
  }) => {
    await setup(page);
    if (!withResume) {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'SpeechRecognition', {
          configurable: true,
          value: undefined,
        });
        Object.defineProperty(window, 'webkitSpeechRecognition', {
          configurable: true,
          value: undefined,
        });
      });
    } else {
      await page.addInitScript(() => {
        class Recognition {
          onstart: (() => void) | null = null;
          onend: (() => void) | null = null;
          onresult: ((event: unknown) => void) | null = null;
          constructor() {
            Object.defineProperty(window, 'syntheticRecognition', {
              configurable: true,
              value: this,
            });
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
          value: Recognition,
        });
      });
    }
    if (!withResume) await page.setViewportSize({ width: 390, height: 844 });
    await begin(page, withResume);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({
      path: `../../docs/backend/evidence/15-entrevista-${withResume ? 'desktop' : 'mobile'}.png`,
      fullPage: true,
    });
    if (withResume) {
      await page.getByRole('button', { name: 'Falar para preencher' }).click();
      await page.evaluate(() => {
        const recognition = (
          window as unknown as { syntheticRecognition: { onresult: (event: unknown) => void } }
        ).syntheticRecognition;
        recognition.onresult({
          resultIndex: 0,
          results: [{ isFinal: true, 0: { transcript: 'Organizei inscrições erradas' } }],
        });
      });
      await page.getByRole('button', { name: 'Confirmar ditado' }).click();
      await expect(page.getByLabel('Sua resposta', { exact: true })).toHaveValue(
        'Organizei inscrições erradas',
      );
      await expect(page.getByRole('button', { name: 'Analisar este bloco' })).toHaveCount(0);
    }
    await page
      .getByLabel('Sua resposta', { exact: true })
      .fill('Organizei inscrições da feira escolar');
    await page.getByRole('button', { name: 'Enviar resposta' }).click();
    await page.getByRole('button', { name: 'Analisar este bloco' }).click();
    await expect(page.getByRole('heading', { name: 'O que você quer manter?' })).toBeVisible();
    await page.getByRole('button', { name: 'Editar este fato' }).click();
    await page.getByLabel('Corrigir fato').fill('Conferi as inscrições da feira escolar.');
    await page.getByRole('button', { name: 'Salvar correção' }).click();
    await expect(
      page.getByRole('button', { name: 'Confirmar os fatos que quero manter' }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Manter este fato' }).click();
    await page.getByRole('button', { name: 'Confirmar os fatos que quero manter' }).click();
    await expect(
      page.getByRole('heading', { name: 'Fatos confirmados para preparar seu currículo' }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({
      path: `../../docs/backend/evidence/15-confirmacao-${withResume ? 'com' : 'sem'}-curriculo.png`,
      fullPage: true,
    });
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Fatos confirmados para preparar seu currículo' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Editar este fato' }).click();
    await page.getByLabel('Corrigir fato').fill('Organizei os nomes na feira escolar.');
    await page.getByRole('button', { name: 'Salvar correção' }).click();
    await expect(
      page.getByRole('heading', { name: 'Fatos confirmados para preparar seu currículo' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Confirmar os fatos que quero manter' }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Remover este fato' }).click();
    await expect(page.getByText(/Este fato será removido/)).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Excluir minha jornada deste aparelho' }).click();
    await expect(page.getByRole('button', { name: 'Começar sem currículo' })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Organizei os nomes na feira escolar.')).toHaveCount(0);
  });
}
test('exclusão durante uma análise impede uma resposta tardia de restaurar a jornada', async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route('**/guest/interview-block', async (route) => {
    started();
    await gate;
    await route.fulfill({ status: 503, json: { code: 'AI_UNAVAILABLE' } });
  });
  await begin(page, false);
  await page.getByLabel('Sua resposta', { exact: true }).fill('Organizei inscrições na escola');
  await page.getByRole('button', { name: 'Enviar resposta' }).click();
  await page.getByRole('button', { name: 'Analisar este bloco' }).click();
  await requestStarted;
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Excluir minha jornada deste aparelho' }).click();
  await expect(page.getByRole('button', { name: 'Começar sem currículo' })).toBeVisible();
  release();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Começar sem currículo' })).toBeVisible();
  await expect(page.getByText('Organizei inscrições na escola')).toHaveCount(0);
});
