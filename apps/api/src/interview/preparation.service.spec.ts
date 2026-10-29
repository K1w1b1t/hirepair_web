import { PreparationService } from './preparation.service';
import { createHash } from 'node:crypto';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const input = {
  version: 1 as const,
  sessionId: 'session',
  funnelSessionId: 'funnel',
  documents: [{ id: 'cv', text: 'Atendimento em loja' }],
  jobText: 'Atendimento',
  objective: 'ENTER_FAST' as const,
  provisional: false,
};
const origin = {
  sourceId: 'cv',
  sourceVersion: hash(input.documents[0].text),
  quote: 'Atendimento em loja',
};
const extraction = {
  experiences: [{ id: 'e', title: 'Loja', start: null, end: null, current: null, origin }],
  facts: [{ id: 'f', experienceId: 'e', text: 'Atendeu clientes', origin }],
};
const analysis = {
  criteria: [
    {
      id: 'c',
      text: 'Atendimento',
      kind: 'explicit',
      category: 'NEGOTIABLE',
      quote: 'Atendimento',
      reason: 'Entender sua experiência',
      evidenceNeeded: 'Exemplo de atendimento',
      objectiveBasis: false,
      relevance: 3,
    },
  ],
  links: [
    {
      id: 'l',
      criterionId: 'c',
      experienceId: 'e',
      factIds: ['f'],
      status: 'candidate',
      declarationTurnId: null,
    },
  ],
  archetype: 'C_OPERATIONAL',
  reason: 'Experiência prática relevante ao alvo.',
};
describe('PreparationService', () => {
  const ai = { generateText: jest.fn(), estimateTokens: jest.fn() };
  const quota = { reserveAnalysis: jest.fn(), finishAnalysis: jest.fn() };
  const access = { verify: jest.fn() };
  const service = new PreparationService(ai as never, quota as never, access as never);
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.AI_PUBLIC_ENABLED = 'true';
    access.verify.mockReturnValue({ visitorId: 'visitor' });
    quota.reserveAnalysis.mockResolvedValue({ owner: 'lease', keys: [] });
    ai.generateText
      .mockResolvedValueOnce({ text: JSON.stringify(extraction) })
      .mockResolvedValueOnce({ text: JSON.stringify(analysis) });
  });
  it('extracts candidates separately from criteria and returns an ordered evidence plan', async () => {
    const result = await service.prepare('token', input, 'network', 'key');
    expect(result.session.facts[0].confirmation).toBe('candidate');
    expect(result.session.plan?.topics[0]).toMatchObject({ criterionId: 'c', experienceId: 'e' });
    expect(ai.generateText).toHaveBeenCalledTimes(2);
    expect(quota.finishAnalysis).toHaveBeenCalledWith(expect.anything(), true);
  });
  it('does not advance on invalid provider output', async () => {
    ai.generateText.mockReset().mockResolvedValue({ text: '{}' });
    await expect(service.prepare('token', input, 'network', 'key')).rejects.toMatchObject({
      status: 502,
    });
    expect(ai.generateText).toHaveBeenCalledTimes(1);
    expect(quota.finishAnalysis).toHaveBeenCalledWith(expect.anything(), false);
  });
  it('rejects invalid inputs before reserving a billable attempt', async () => {
    for (const invalid of [
      { ...input, objective: 'INFER' as never },
      { ...input, documents: [] },
      { ...input, documents: [{ id: 'x', text: ' ' }] },
      { ...input, documents: [input.documents[0], input.documents[0]] },
      { ...input, jobText: '' },
      { ...input, jobText: 'a'.repeat(20_001) },
    ])
      await expect(service.prepare('token', invalid, 'network', 'key')).rejects.toMatchObject({
        status: 400,
      });
    expect(quota.reserveAnalysis).not.toHaveBeenCalled();
  });
  it('supports a target without inferring vacancy criteria', async () => {
    ai.generateText
      .mockReset()
      .mockResolvedValueOnce({ text: JSON.stringify(extraction) })
      .mockResolvedValueOnce({ text: JSON.stringify({ ...analysis, criteria: [], links: [] }) });
    const result = await service.prepare(
      'token',
      { ...input, jobText: undefined, targetRole: 'Atendente' },
      'network',
      'key',
    );
    expect(result.session.criteria).toEqual([]);
  });
  it('rejects invalid analysis after extraction without a third provider call', async () => {
    ai.generateText
      .mockReset()
      .mockResolvedValueOnce({ text: JSON.stringify(extraction) })
      .mockResolvedValueOnce({ text: '{}' });
    await expect(service.prepare('token', input, 'network', 'key')).rejects.toMatchObject({
      status: 502,
    });
    expect(ai.generateText).toHaveBeenCalledTimes(2);
    expect(quota.finishAnalysis).toHaveBeenCalledWith(expect.anything(), false);
  });
});
