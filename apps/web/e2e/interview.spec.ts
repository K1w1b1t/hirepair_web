import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { preparationFixture } from '../test/preparation';
import { mockGuestChallenge } from './helpers/guest-challenge';
import type { InterviewBlockRequest, Session } from '@hirepair/interview-engine';
async function captureScreen(page: Page, options: NonNullable<Parameters<Page['screenshot']>[0]>) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        return window.scrollY;
      }),
    )
    .toBe(0);
  return page.screenshot(options);
}
async function savedState(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        facts: Array<{ id: string; usable: boolean }>;
        turns: Array<{ id: string; length: number }>;
        analyzed: string[];
        disputed: string[];
      }>((resolve, reject) => {
        const open = indexedDB.open('hirepair-interview', 1);
        open.onerror = () => reject(new Error('Cannot read fixture state'));
        open.onsuccess = () => {
          const db = open.result,
            request = db.transaction('session', 'readonly').objectStore('session').get('active');
          request.onerror = () => reject(new Error('Cannot read fixture state'));
          request.onsuccess = () => {
            const s = request.result as Session;
            db.close();
            resolve({
              facts: s.facts.map((f) => ({ id: f.id, usable: f.usable })),
              turns: s.turns.map((t) => ({ id: t.id, length: t.answer.text.length })),
              analyzed: s.interview?.analyzedTurnIds ?? [],
              disputed: s.pending.filter((p) => p.blocking).flatMap((p) => p.factIds),
            });
          };
        };
      }),
  );
}
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
  await page.route('**/guest/interview-preparation', (r) => {
    const request = r.request().postDataJSON();
    const result = preparationFixture(request);
    const source = result.session.sources[0];
    const origin = { sourceId: source.id, sourceVersion: source.version, quote: source.text };
    result.session.experiences = [
      {
        id: 'recent',
        title: 'Atendente no Mercado Azul',
        start: '2024',
        end: null,
        current: true,
        origin,
      },
      {
        id: 'first',
        title: 'Auxiliar na Padaria Sol',
        start: '2018',
        end: '2024',
        current: false,
        origin,
      },
    ];
    return r.fulfill({ json: result, status: 201 });
  });
  await page.route('**/guest/interview-block', async (route) => {
    const request = route.request().postDataJSON() as InterviewBlockRequest,
      discovery = request.turns.find(
        (t) => t.topicId === 'guided:first' || t.topicId.startsWith('guided:next:'),
      ),
      t = discovery ?? request.turns[0],
      origin = {
        sourceId: t.id,
        sourceVersion: createHash('sha256').update(t.text).digest('hex'),
        quote: t.text.slice(0, 120),
      };
    await route.fulfill({
      status: 201,
      json: {
        version: 1,
        revision: request.revision,
        extraction: {
          experiences: discovery
            ? [
                {
                  id: discovery.topicId === 'guided:first' ? 'padaria' : 'market',
                  title:
                    discovery.topicId === 'guided:first'
                      ? 'Auxiliar na Padaria Sol'
                      : 'Atendente no Mercado Azul',
                  start: null,
                  end: null,
                  current: /atualmente/i.test(t.text),
                  origin,
                },
              ]
            : [],
          facts: [
            {
              id: `fact-${t.id}-${request.revision}`,
              experienceId: discovery
                ? discovery.topicId === 'guided:first'
                  ? 'padaria'
                  : 'market'
                : request.topics[0].experienceId!,
              text: t.text.slice(0, 120),
              origin,
            },
          ],
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
async function begin(
  page: Page,
  withResume: boolean,
  cvText = 'Auxiliar na Padaria Sol, 2018 a 2024. Atendente no Mercado Azul desde 2024.',
) {
  await page.goto('/conversa');
  await page.getByRole('button', { name: 'Agora não' }).click();
  if (withResume) {
    await page.getByLabel('Colar o texto').fill(cvText);
    await page.getByRole('button', { name: 'Adicionar material' }).click();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  } else await page.getByText('Começar sem currículo').click();
  await page.getByLabel('Seu objetivo pessoal').selectOption('ENTER_FAST');
  await page.getByLabel(/requisitos da vaga/i).fill('Atendimento ao público');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /analisar e sugerir/i }).click();
  await expect(page.getByRole('progressbar', { name: 'Progresso da entrevista' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}
for (const withResume of [false, true])
  test(`entrevista guiada ${withResume ? 'com' : 'sem'} currículo avança para revisão do currículo`, async ({
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
    await expect(page.getByRole('link', { name: 'Voltar para o início' })).toBeVisible();
    await expect(page.locator('.guided-interview').getByRole('button')).toHaveCount(2);
    await captureScreen(page, {
      path: `../../docs/backend/evidence/18-interview-${withResume ? 'desktop' : 'mobile-text'}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      withResume ? 'Auxiliar na Padaria Sol · 2018' : 'primeira experiência profissional',
    );
    const responses = withResume
      ? [
          'Eu embalava pedidos.',
          'Atendo os clientes.',
          'No Mercado Azul.',
          'Uso um caderno.',
          'Diariamente.',
          'Organizo os pedidos atrasados.',
          'As entregas ficaram organizadas.',
        ]
      : [
          'Minha primeira experiência foi como auxiliar na Padaria Sol.',
          'De 2018 a 2019.',
          'Eu embalava pedidos.',
          'Atualmente sou atendente no Mercado Azul.',
          'Desde 2024.',
          'Eu atendo os clientes.',
          'No Mercado Azul do bairro.',
          'Uso um caderno.',
          'Diariamente.',
          'Organizo os pedidos atrasados.',
          'As entregas ficaram organizadas.',
        ];
    for (let i = 0; i < responses.length; i++) {
      if (await page.getByText('Confira seu currículo', { exact: true }).isVisible()) break;
      await page.getByLabel('Sua resposta', { exact: true }).fill(responses[i]);
      await page.getByRole('button', { name: 'Enviar resposta' }).click();
      await expect(page.getByText(`${i + 1} respostas recebidas`)).toBeVisible();
      await expect(page.getByText('Organizando sua resposta…')).toHaveCount(0);
      await expect(
        page
          .getByRole('button', { name: 'Enviar resposta' })
          .or(page.getByText('Confira seu currículo', { exact: true })),
      ).toBeVisible();
    }
    await expect(page.getByText('Confira seu currículo', { exact: true })).toBeVisible();
    if (withResume)
      await captureScreen(page, {
        path: '../../docs/backend/evidence/18-before-writing-desktop.png',
        fullPage: true,
        animations: 'disabled',
      });
    await expect(page.getByText('O que você quer manter?')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Preparar meu currículo' })).toBeVisible();
    let calls = 0;
    await page.route('**/guest/resume-writing', async (route) => {
      calls++;
      const request = route.request().postDataJSON() as { session: Session };
      const fact = request.session.facts.find((item) =>
        request.session.selection!.facts.some((selected) => selected.id === item.id),
      )!;
      await route.fulfill({
        status: 201,
        json: {
          version: 1,
          revision: request.session.revision,
          content: {
            version: 1,
            explanation: 'Experiência pertinente ao atendimento.',
            sections: [
              {
                id: 'experience',
                title: 'Experiências',
                experienceId: fact.experienceId,
                units: [{ id: 'bullet', text: fact.text, factIds: [fact.id], criterionIds: [] }],
              },
            ],
          },
        },
      });
    });
    await page.getByRole('button', { name: 'Preparar meu currículo' }).click();
    await page.getByRole('button', { name: 'Editar nome e contatos' }).click();
    await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Ana Exemplo');
    await page.getByRole('textbox', { name: 'Título profissional', exact: true }).fill('Atendente');
    await page
      .getByRole('textbox', { name: 'E-mail', exact: true })
      .fill('ana.exemplo@example.com');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('button', { name: 'Aprovar currículo' })).toBeVisible();
    await captureScreen(page, {
      path: `../../docs/backend/evidence/18-review-${withResume ? 'desktop' : 'mobile'}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    const editExperience = page.getByRole('button', { name: 'Editar Experiências' });
    await expect(editExperience).toHaveText('Editar');
    await editExperience.click();
    await expect(page.getByLabel('Título da seção')).toHaveValue('Experiências');
    await expect(page.getByRole('textbox', { name: 'Conteúdo', exact: true })).not.toHaveValue('');
    await page
      .getByRole('textbox', { name: 'Conteúdo', exact: true })
      .fill('Atendeu clientes no comércio local.');
    await captureScreen(page, {
      path: `../../docs/backend/evidence/18-edit-${withResume ? 'desktop' : 'mobile'}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await page.getByRole('button', { name: 'Adicionar seção' }).click();
    await expect(page.getByLabel('Título da seção')).toHaveValue('');
    await captureScreen(page, {
      path: `../../docs/backend/evidence/18-add-empty-${withResume ? 'desktop' : 'mobile'}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByLabel('Título da seção').fill('Cursos');
    await page
      .getByRole('textbox', { name: 'Conteúdo', exact: true })
      .fill('Curso de atendimento ao cliente — exemplo sintético.');
    await captureScreen(page, {
      path: `../../docs/backend/evidence/18-add-filled-${withResume ? 'desktop' : 'mobile'}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('button', { name: 'Editar Cursos' })).toBeVisible();
    await page.getByRole('button', { name: 'Aprovar currículo' }).click();
    await page.waitForURL(/\/meus-curriculos\/[^/]+$/);
    await expect(page.locator('.pdf-pages canvas[data-rendered=true]')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Currículo aprovado' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Editar/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Adicionar seção' })).toHaveCount(0);
    await captureScreen(page, {
      path: `../../docs/backend/evidence/18-approved-${withResume ? 'desktop' : 'mobile'}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Currículo aprovado' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Editar/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Adicionar seção' })).toHaveCount(0);
    expect(calls).toBe(1);
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
  await captureScreen(page, {
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
  await expect(page.getByRole('link', { name: 'Voltar para o início' })).toBeVisible();
  await expect(page.locator('.guided-interview').getByRole('button')).toHaveCount(2);
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
test('uma habilidade negada permanece bloqueada depois da análise e da retomada', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/guest/interview-preparation', (route) => {
    const result = preparationFixture(route.request().postDataJSON()),
      source = result.session.sources[0];
    const origin = {
      sourceId: source.id,
      sourceVersion: source.version,
      quote: 'Auxiliar na Padaria Sol',
    };
    result.session.experiences = [
      {
        id: 'first',
        title: 'Auxiliar na Padaria Sol',
        start: '2018',
        end: null,
        current: true,
        origin,
      },
    ];
    result.session.facts = [
      {
        id: 'excel',
        experienceId: 'first',
        storyId: null,
        text: 'Excel',
        origin: { ...origin, quote: 'Excel' },
        confirmation: 'candidate',
        externallyVerified: false,
        usable: true,
        revision: 1,
      },
    ];
    return route.fulfill({ status: 201, json: result });
  });
  const requests: InterviewBlockRequest[] = [];
  await page.route('**/guest/interview-block', (route) => {
    const request = route.request().postDataJSON() as InterviewBlockRequest;
    requests.push(request);
    return route.fulfill({
      status: 201,
      json: {
        version: 1,
        revision: request.revision,
        extraction: { experiences: [], facts: [] },
        analysis: null,
        assessments: request.topics.map((t) => ({
          topicId: t.id,
          sufficient: true,
          evidence: [],
          question: null,
          contradictionFactIds: [],
        })),
      },
    });
  });
  await begin(page, true, 'Auxiliar na Padaria Sol desde 2018.\nHabilidades: Excel');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Excel');
  await page.getByLabel('Sua resposta', { exact: true }).fill('Não tenho essa experiência.');
  await page.getByText('Enviar resposta', { exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].turns[0].kind).toBe('absence');
  await expect.poll(async () => (await savedState(page)).analyzed.length).toBe(1);
  expect((await savedState(page)).facts).toContainEqual({ id: 'excel', usable: false });
  await page.reload();
  await expect(page.getByRole('progressbar', { name: 'Progresso da entrevista' })).toBeVisible();
  expect((await savedState(page)).disputed).toContain('excel');
  await expect(page.getByRole('link', { name: 'Voltar para o início' })).toBeVisible();
  await expect(page.locator('.guided-interview').getByRole('button')).toHaveCount(2);
});
test('respostas longas são analisadas em blocos válidos sem perder os turnos restantes', async ({
  page,
}) => {
  await setup(page);
  const requests: InterviewBlockRequest[] = [];
  await page.route('**/guest/interview-block', (route) => {
    requests.push(route.request().postDataJSON() as InterviewBlockRequest);
    return route.fallback();
  });
  await begin(page, false);
  for (let i = 0; i < 3; i++) {
    const response = `Eu trabalhava na Padaria Sol ${i}. ` + 'a'.repeat(6900);
    await page.getByLabel('Sua resposta', { exact: true }).fill(response);
    await page.getByText('Enviar resposta', { exact: true }).click();
    await expect(page.getByText(`${i + 1} respostas recebidas`)).toBeVisible();
    await expect(page.getByText('Organizando sua resposta…')).toHaveCount(0);
  }
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  requests.forEach((request) => expect(JSON.stringify(request).length).toBeLessThanOrEqual(20000));
  const saved = await savedState(page);
  expect(saved.turns).toHaveLength(3);
  expect(saved.turns.every((t) => t.length > 6900)).toBe(true);
  expect(saved.analyzed.length).toBeLessThan(3);
  await expect(page.getByText('Suas respostas estão salvas', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Voltar para o início' })).toBeVisible();
  await expect(page.locator('.guided-interview').getByRole('button')).toHaveCount(2);
});
