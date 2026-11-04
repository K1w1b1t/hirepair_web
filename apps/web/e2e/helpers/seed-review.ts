import type { Page } from '@playwright/test';
import { createWritingTestSession } from '../../test/writing';
import { startGuided, type Session } from '@hirepair/interview-engine';
import { createHash } from 'node:crypto';
import type { PdfInput } from '../../src/app/conversa/_lib/pdf-contract';
export async function seedReview(
  page: Page,
  archetype = 'D_SAME_FIELD_RETURN',
  units = 3,
  profileName = 'Ana Exemplo Sintética',
  reference?: PdfInput,
) {
  await page.goto('/meus-curriculos');
  if (await page.getByRole('button', { name: 'Agora não' }).isVisible())
    await page.getByRole('button', { name: 'Agora não' }).click();
  const s = startGuided(createWritingTestSession());
  s.guided!.status = 'complete';
  s.writing = {
    status: 'review',
    key: 'writing',
    inputHash: 'input',
    approval: null,
    original: null,
    draft: reference?.document ?? {
      version: 1,
      explanation: 'Fixture sintética #20',
      sections: [
        {
          id: 'summary',
          title: 'Experiência profissional',
          experienceId: null,
          units: Array.from({ length: units }, (_, i) => ({
            id: `u${i}`,
            text: `Atendeu clientes com atenção e organização. Experiência ${i + 1} — São Paulo, 2024–2026. https://example.com/projeto`,
            factIds: ['f'],
            criterionIds: [],
          })),
        },
      ],
    },
  };
  s.strategy = {
    id: 'strategy',
    version: 1,
    valid: true,
    inputs: s.inputs,
    dependencies: [],
    archetype: archetype as NonNullable<Session['strategy']>['archetype'],
    tone: 'DIRECT',
    reason: 'Fixture sintética',
    formula: 'CAR',
  };
  const draft = {
    hasJob: false,
    jobText: '',
    targetRole: 'Atendente',
    objective: 'ENTER_FAST',
    accepted: false,
  };
  const inputHash = createHash('sha256')
    .update(JSON.stringify({ documents: [], draft }))
    .digest('hex');
  await page.evaluate(
    async ({ s, draft, inputHash, profileName, profile }) => {
      const open = indexedDB.open('hirepair-interview', 1);
      await new Promise<void>((resolve, reject) => {
        open.onupgradeneeded = () => open.result.createObjectStore('session');
        open.onerror = () =>
          reject(new Error('Não foi possível abrir IndexedDB', { cause: open.error }));
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction('session', 'readwrite'),
            store = tx.objectStore('session');
          store.put(s, 'active');
          store.put(
            {
              name: profileName,
              professionalTitle: 'Atendente',
              email: 'ana@example.com',
              phone: '',
              confirmed: true,
              ...profile,
            },
            'header-profile',
          );
          store.put({ id: 'journey', phase: 'interview', withoutResume: true }, 'journey');
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      });
      localStorage.setItem(
        'hirepair_job_analysis',
        JSON.stringify({
          version: 3,
          draft,
          inputHash,
          preferences: {
            archetype: s.strategy!.archetype,
            objective: 'ENTER_FAST',
            tone: 'DIRECT',
          },
          result: {
            targetRole: 'Atendente',
            summary: 'Fixture sintética',
            requirements: [],
            suggestedArchetype: s.strategy!.archetype,
            suggestedObjective: 'ENTER_FAST',
            suggestedTone: 'DIRECT',
            reason: 'Fixture sintética',
          },
        }),
      );
    },
    { s, draft, inputHash, profileName, profile: reference?.profile },
  );
  // Calculate with the exact production fingerprint shape in the browser fixture.
  await page.evaluate(async () => {
    const value = JSON.parse(localStorage.getItem('hirepair_job_analysis')!);
    const payload = JSON.stringify({
      version: 2,
      objective: value.draft.objective,
      provisional: !!value.draft.provisional,
      documents: [],
      hasJob: value.draft.hasJob,
      target: value.draft.targetRole,
    });
    value.inputHash = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))),
      (b) => b.toString(16).padStart(2, '0'),
    ).join('');
    localStorage.setItem('hirepair_job_analysis', JSON.stringify(value));
  });
  await page.goto('/conversa?etapa=interview&sem-curriculo=1');
}
