jest.mock('./diagnostic', () => ({ __esModule: true, ...jest.requireActual('./diagnostic') }));
jest.mock('./engine-storage', () => {
  const actual = jest.requireActual<typeof import('./engine-storage')>('./engine-storage');
  return { __esModule: true, ...actual, readEngine: jest.fn(actual.readEngine) };
});
import 'fake-indexeddb/auto';
import { serialize, deserialize } from 'node:v8';
import { analyzeGuest, cancelPreparation } from './guest-api';
import { readEngine, deleteEngine, saveEngine } from './engine-storage';
import { preparationFixture } from '../../../../test/preparation';
Object.defineProperty(globalThis, 'structuredClone', {
  configurable: true,
  value: (value: unknown) => deserialize(serialize(value)),
});
const draft = {
  hasJob: true,
  jobText: 'Atendimento',
  targetRole: 'Atendente',
  objective: 'ENTER_FAST' as const,
  provisional: true,
  accepted: true,
};
const challenge = { token: 'proof', termsVersion: 'v', privacyVersion: 'v' };
const documents = [{ id: 'cv', text: 'Atendimento' }];
const fetchMock = jest.fn();
beforeEach(async () => {
  const mocked = jest.requireMock('./engine-storage') as { readEngine: jest.Mock };
  const actual = jest.requireActual<typeof import('./engine-storage')>('./engine-storage');
  mocked.readEngine.mockReset().mockImplementation(actual.readEngine);
  await deleteEngine();
  localStorage.clear();
  sessionStorage.clear();
  fetchMock.mockReset();
  global.fetch = fetchMock;
});
const access = () =>
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'token' }) });
const success = () => {
  access();
  fetchMock.mockImplementationOnce((_url: string, options: { body: string }) =>
    Promise.resolve({ ok: true, json: async () => preparationFixture(JSON.parse(options.body)) }),
  );
};
it('persists the prepared session locally with explicit objective and shared funnel identity', async () => {
  success();
  const result = await analyzeGuest(documents, draft, challenge);
  expect(result.preparation?.phase).toBe('interview');
  expect(result.suggestedObjective).toBe('ENTER_FAST');
  expect((await readEngine())?.objective?.value).toBe('ENTER_FAST');
  expect(fetchMock.mock.calls[1][0]).toContain('interview-preparation');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
    objective: 'ENTER_FAST',
    provisional: true,
  });
  success();
  await analyzeGuest(documents, { ...draft, provisional: false }, challenge);
  expect((await readEngine())?.revision).toBe(2);
});
it('retains identified confirmed history when retargeting', async () => {
  success();
  await analyzeGuest(documents, draft, challenge);
  const previous = (await readEngine())!;
  previous.experiences = [
    {
      id: 'e',
      title: 'Loja',
      start: null,
      end: null,
      current: true,
      origin: { sourceId: 'cv', sourceVersion: 'v', quote: 'Atendimento' },
    },
  ];
  previous.facts = [
    {
      id: 'f',
      experienceId: 'e',
      storyId: null,
      text: 'Atendeu clientes',
      origin: previous.experiences[0].origin,
      confirmation: 'confirmed',
      externallyVerified: false,
      usable: true,
      revision: 1,
    },
  ];
  await saveEngine(previous, previous.revision);
  success();
  const result = await analyzeGuest(documents, { ...draft, jobText: 'Outro alvo' }, challenge);
  expect(result.preparation?.facts[0].confirmation).toBe('confirmed');
  expect(result.preparation?.experiences[0].id).toBe('e');
});
it('rejects malformed server responses without advancing the local placeholder', async () => {
  access();
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ version: 1, session: {} }) });
  await expect(analyzeGuest(documents, draft, challenge)).rejects.toMatchObject({
    code: 'AI_INVALID_RESPONSE',
  });
  expect((await readEngine())?.phase).toBe('preparation');
});
it('cancels before a late response can restore deleted data', async () => {
  access();
  let release!: (value: unknown) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const pending = analyzeGuest(documents, draft, challenge);
  while (!release) await new Promise((resolve) => setTimeout(resolve, 1));
  cancelPreparation();
  await deleteEngine();
  release({ ok: true, json: async () => ({}) });
  await expect(pending).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
  expect(await readEngine()).toBeNull();
});
it('rejects a successful response addressed to another session or objective', async () => {
  for (const mismatch of ['session', 'funnel', 'objective']) {
    await deleteEngine();
    fetchMock.mockReset();
    access();
    fetchMock.mockImplementationOnce((_url: string, options: { body: string }) => {
      const value = preparationFixture(JSON.parse(options.body));
      if (mismatch === 'session') value.session.id = 'other';
      if (mismatch === 'funnel') value.session.funnelSessionId = 'other';
      if (mismatch === 'objective') value.session.objective!.value = 'CHANGE_FIELD';
      return Promise.resolve({ ok: true, json: async () => value });
    });
    await expect(analyzeGuest(documents, draft, challenge)).rejects.toMatchObject({
      code: 'AI_INVALID_RESPONSE',
    });
  }
});
it('cancels an uncertain access response before creating a new local session', async () => {
  let release!: (value: unknown) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const pending = analyzeGuest(documents, draft, challenge);
  while (!release) await new Promise((resolve) => setTimeout(resolve, 1));
  cancelPreparation();
  release({ ok: true, json: async () => ({ accessToken: 'token' }) });
  await expect(pending).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
  expect(await readEngine()).toBeNull();
});
it('supports a declared role without inventing criteria for a missing vacancy', async () => {
  success();
  const result = await analyzeGuest(documents, { ...draft, hasJob: false }, challenge);
  expect(result.preparation?.criteria).toEqual([]);
});
it('cancels while reading local state before a new placeholder is written', async () => {
  const storage = await import('./engine-storage');
  let release!: (value: null) => void;
  const read = jest.spyOn(storage, 'readEngine').mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  access();
  const pending = analyzeGuest(documents, draft, challenge);
  while (!release) await new Promise((resolve) => setTimeout(resolve, 1));
  cancelPreparation();
  release(null);
  await expect(pending).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
  read.mockRestore();
});
it.each(['AI_CAPACITY_EXHAUSTED', 'GUEST_ANALYSIS_LIMIT_REACHED', 'AI_INVALID_RESPONSE'])(
  'persists an explicit interruption reason after a known preparation failure: %s',
  async (code) => {
    access();
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ code }) });
    await expect(analyzeGuest(documents, draft, challenge)).rejects.toMatchObject({ code });
    expect((await readEngine())?.interruption).toMatchObject({
      kind: code === 'AI_INVALID_RESPONSE' ? 'paused' : 'budget_exhausted',
      reason: code,
      resumePhase: 'preparation',
    });
  },
);

it('preserves the original provider error when interruption persistence fails', async () => {
  const mocked = jest.requireMock('./engine-storage') as { readEngine: jest.Mock };
  const actual = jest.requireActual<typeof import('./engine-storage')>('./engine-storage');
  mocked.readEngine
    .mockImplementationOnce(actual.readEngine)
    .mockRejectedValueOnce(new Error('quota'));
  access();
  fetchMock.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ code: 'AI_CAPACITY_EXHAUSTED' }),
  });
  await expect(analyzeGuest(documents, draft, challenge)).rejects.toMatchObject({
    code: 'AI_CAPACITY_EXHAUSTED',
  });
});
it('does not write an interruption into a session deleted by another tab', async () => {
  access();
  fetchMock.mockImplementationOnce(async () => {
    await deleteEngine();
    return { ok: false, json: async () => ({ code: 'AI_CAPACITY_EXHAUSTED' }) };
  });
  await expect(analyzeGuest(documents, draft, challenge)).rejects.toMatchObject({
    code: 'AI_CAPACITY_EXHAUSTED',
  });
  expect(await readEngine()).toBeNull();
});
it('does not restore interrupted data after explicit cancellation', async () => {
  access();
  fetchMock.mockImplementationOnce(async () => {
    cancelPreparation();
    await deleteEngine();
    return { ok: false, json: async () => ({ code: 'AI_CAPACITY_EXHAUSTED' }) };
  });
  await expect(analyzeGuest(documents, draft, challenge)).rejects.toMatchObject({
    code: 'AI_CAPACITY_EXHAUSTED',
  });
  expect(await readEngine()).toBeNull();
});
it('does not advance for an invalid response implementation at the HTTP boundary', async () => {
  access();
  fetchMock.mockResolvedValueOnce({
    ok: false,
    json: () => {
      throw new Error('invalid JSON reader');
    },
  });
  await expect(analyzeGuest(documents, draft, challenge)).rejects.toThrow('invalid JSON reader');
  expect((await readEngine())?.phase).toBe('preparation');
});
it('uses internal document findings to enrich the interview plan without an extra provider request', async () => {
  success();
  const result = await analyzeGuest(
    [{ id: 'cv', text: 'CPF: 123.456.789-09\nDomínio completo da operação.' }],
    draft,
    challenge,
  );
  expect(result.preparation?.diagnostics?.[0].findings.map((f) => f.code)).toEqual(
    expect.arrayContaining(['UNNECESSARY_PERSONAL_DATA', 'SCOPE_NEEDS_SUPPORT']),
  );
  expect(result.preparation?.plan?.topics.some((t) => t.diagnosticFindingId)).toBe(true);
  expect((await readEngine())?.diagnostics).toEqual(result.preparation?.diagnostics);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('123.456.789-09');
});

import * as diagnostic from './diagnostic';
import { resolveDiagnosticFinding } from '@hirepair/interview-engine';
it('cancels during local diagnosis without committing a stale prepared session', async () => {
  const actual = jest.requireActual<typeof import('./diagnostic')>('./diagnostic');
  const spy = jest
    .spyOn(diagnostic, 'diagnoseStoredDocuments')
    .mockImplementationOnce(async (...args) => {
      const reports = await actual.diagnoseStoredDocuments(...args);
      cancelPreparation();
      return reports;
    });
  try {
    success();
    await expect(analyzeGuest(documents, draft, challenge)).rejects.toMatchObject({
      code: 'REQUEST_CANCELLED',
    });
    expect((await readEngine())?.phase).toBe('preparation');
  } finally {
    spy.mockRestore();
  }
});
it('preserves unresolved diagnostic pending items and does not reopen a resolved finding on reprepare', async () => {
  const docs = [{ id: 'cv', text: 'Domínio completo' }];
  success();
  await analyzeGuest(docs, draft, challenge);
  const previous = (await readEngine())!;
  const finding = previous.diagnostics![0].findings[0];
  previous.pending.push({
    id: 'unrelated',
    criterionId: null,
    factIds: [],
    reason: 'unrelated',
    blocking: false,
  });
  await saveEngine(previous, previous.revision);
  success();
  await analyzeGuest(docs, draft, challenge);
  const current = (await readEngine())!;
  expect(current.pending.some((p) => p.diagnosticFindingId === finding.id)).toBe(true);
  expect(current.plan!.topics.filter((t) => t.diagnosticFindingId)).toEqual(
    previous.plan!.topics.filter((t) => t.diagnosticFindingId),
  );
  const resolved = resolveDiagnosticFinding(current, finding.id);
  await saveEngine({ ...resolved, revision: current.revision + 1 }, current.revision);
  success();
  const result = await analyzeGuest(docs, draft, challenge);
  expect(result.preparation!.pending.filter((p) => p.diagnosticFindingId)).toEqual([]);
  expect(result.preparation!.plan!.topics.filter((t) => t.diagnosticFindingId)).toEqual([]);
});
