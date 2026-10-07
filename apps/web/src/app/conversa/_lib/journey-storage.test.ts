import { ANALYSIS_KEY } from './job-analysis';
import { inputFingerprint } from './guest-api';
import { initialDraft, persistJourney, restoreJourney } from './journey-storage';
const documents = [{ id: 'id', text: 'Mecânico' }];
const draft = { ...initialDraft, jobText: 'Manutenção', accepted: true };
const result = {
  targetRole: 'Mecânico',
  summary: 'Sugestão',
  reason: 'Histórico',
  requirements: [],
  suggestedArchetype: 'C_OPERATIONAL' as const,
  suggestedObjective: 'ENTER_FAST' as const,
  suggestedTone: 'DIRECT' as const,
};
const preferences = {
  archetype: 'C_OPERATIONAL' as const,
  objective: 'ENTER_FAST' as const,
  tone: 'DIRECT' as const,
};
describe('local journey retention and input versions', () => {
  beforeEach(() => localStorage.clear());
  it('restores matching results without an expiry and without restoring consent', async () => {
    persistJourney({
      draft,
      result,
      preferences,
      inputHash: await inputFingerprint(documents, draft),
    });
    const restored = await restoreJourney(documents);
    expect(restored.result).toEqual(result);
    expect(restored.preferences).toEqual(preferences);
    expect(restored.draft).toEqual({ ...draft, accepted: false });
    expect(localStorage.getItem(ANALYSIS_KEY)).not.toContain('expires');
  });
  it('invalidates changed materials while retaining the vacancy draft', async () => {
    persistJourney({
      draft,
      result,
      preferences,
      inputHash: await inputFingerprint(documents, draft),
    });
    expect(await restoreJourney([{ id: 'id', text: 'Changed' }])).toEqual({
      draft: { ...draft, accepted: false },
    });
    expect((await restoreJourney([])).result).toBeUndefined();
  });
  it('requires a new analysis for legacy and malformed records', async () => {
    for (const value of [
      'not-json',
      'null',
      JSON.stringify({ result, ...preferences }),
      JSON.stringify({ version: 2, draft, result, preferences, inputHash: 'stale' }),
    ]) {
      localStorage.setItem(ANALYSIS_KEY, value);
      expect((await restoreJourney(documents)).result).toBeUndefined();
    }
  });
  it.each([
    null,
    {},
    { hasJob: 'wrong' },
    { hasJob: true },
    { hasJob: true, jobText: 1 },
    { hasJob: true, jobText: '' },
    { hasJob: true, jobText: '', targetRole: 1 },
  ])('rejects invalid stored draft %j', async (invalid) => {
    localStorage.setItem(ANALYSIS_KEY, JSON.stringify({ version: 2, draft: invalid }));
    expect((await restoreJourney(documents)).draft).toEqual(initialDraft);
  });
  it.each([
    null,
    {},
    { archetype: 'wrong' },
    { archetype: 'C_OPERATIONAL', objective: 'wrong' },
    { archetype: 'C_OPERATIONAL', objective: 'ENTER_FAST', tone: 'wrong' },
  ])('rejects invalid preferences %j', async (invalid) => {
    localStorage.setItem(
      ANALYSIS_KEY,
      JSON.stringify({ version: 2, draft, result, preferences: invalid }),
    );
    expect((await restoreJourney(documents)).result).toBeUndefined();
  });
});
