import type { AiTextGenerationRequest } from '../ai/ai.types';
import { GuestAnalysisService } from './guest-analysis.service';
const input = {
  documents: [{ id: 'resume', text: 'Mecânico 2018–2024 CPF: 123.456.789-00' }],
  jobText: 'Vaga de manutenção',
};
describe('GuestAnalysisService', () => {
  const ai = {
    generateText: jest.fn<Promise<{ text: string }>, [AiTextGenerationRequest]>(),
    estimateTokens: jest.fn(),
  };
  const quota = { reserveAnalysis: jest.fn(), finishAnalysis: jest.fn() };
  const access = { verify: jest.fn() };
  const service = new GuestAnalysisService(ai as never, quota as never, access as never);
  const analyze = (request = input) => service.analyze('token', request, 'network', 'key');
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.AI_PUBLIC_ENABLED = 'true';
    access.verify.mockReturnValue({ visitorId: 'visitor' });
    quota.reserveAnalysis.mockResolvedValue({ owner: 'owner', keys: [] });
  });
  it.each([
    ['different_track', 'B_CAREER_CHANGE', 'CONSULTATIVE', 'CHANGE_FIELD'],
    ['first_job', 'A_FIRST_JOB', 'DIRECT', 'ENTER_FAST'],
    ['operational', 'C_OPERATIONAL', 'DIRECT', 'ENTER_FAST'],
    ['specialist', 'E_SPECIALIST', 'TECHNICAL', 'ENTER_FAST'],
    ['same_track', 'D_SAME_FIELD_RETURN', 'NEUTRAL', 'ENTER_FAST'],
  ])(
    'preserves existing recommendations for %s while minimizing data',
    async (kind, archetype, tone, objective) => {
      ai.generateText.mockResolvedValue({
        text: JSON.stringify({ targetKind: kind, targetRole: 'Mecânico', requirements: [] }),
      });
      await expect(analyze()).resolves.toMatchObject({
        suggestedArchetype: archetype,
        suggestedTone: tone,
        suggestedObjective: objective,
      });
      expect(ai.generateText.mock.calls[0][0].prompt).not.toContain('123.456.789-00');
      expect(ai.generateText.mock.calls[0][0].context).toMatchObject({
        principalId: 'visitor',
        operation: 'job-analysis',
      });
      expect(quota.finishAnalysis).toHaveBeenCalledWith(expect.anything(), true);
    },
  );
  it('counts failures and never releases the attempt', async () => {
    ai.generateText.mockRejectedValue(new Error('offline'));
    await expect(analyze()).rejects.toThrow('offline');
    expect(quota.finishAnalysis).toHaveBeenCalledWith(expect.anything(), false);
  });
  it.each([
    'not json',
    'null',
    '[]',
    '{}',
    '{"targetKind":"same_track","targetRole":1,"requirements":[]}',
    '{"targetKind":"same_track","targetRole":"","requirements":[null]}',
  ])('rejects invalid output safely: %s', async (text) => {
    ai.generateText.mockResolvedValue({ text });
    await expect(analyze()).rejects.toMatchObject({ status: 502 });
  });
  it('reports empty and oversized material as client errors before reservation', async () => {
    await expect(analyze({ ...input, documents: [] })).rejects.toMatchObject({ status: 400 });
    await expect(analyze({ ...input, documents: [{ id: 'x', text: ' ' }] })).rejects.toMatchObject({
      status: 400,
    });
    await expect(analyze({ ...input, jobText: '' })).rejects.toMatchObject({ status: 400 });
    await expect(analyze({ ...input, jobText: 'a'.repeat(20_001) })).rejects.toMatchObject({
      status: 400,
    });
    expect(quota.reserveAnalysis).not.toHaveBeenCalled();
  });
  it.each([1, 2])('keeps the existing summary for %i requirements', async (count) => {
    ai.generateText.mockResolvedValue({
      text:
        '```json\n' +
        JSON.stringify({
          targetKind: 'same_track',
          targetRole: '',
          requirements: Array.from({ length: count }, () => ({
            text: 'Manutenção',
            category: 'NEGOTIABLE',
          })),
        }) +
        '\n```',
    });
    const result = await analyze({ ...input, jobText: 'Vaga remota' });
    expect(result.summary).toContain(String(count));
    expect(result.suggestedObjective).toBe('WORK_REMOTE');
    expect(result.targetRole).toBe('seu próximo cargo');
  });
});

it('accepts a target role without a pasted vacancy and preserves its fallback', async () => {
  process.env.AI_PUBLIC_ENABLED = 'true';
  const ai = {
    estimateTokens: jest.fn(),
    generateText: jest.fn().mockResolvedValue({
      text: JSON.stringify({ targetKind: 'same_track', targetRole: '', requirements: [] }),
    }),
  };
  const s = new GuestAnalysisService(
    ai as never,
    { reserveAnalysis: jest.fn(), finishAnalysis: jest.fn() } as never,
    { verify: () => ({ visitorId: 'v' }) } as never,
  );
  expect(
    await s.analyze(
      'token',
      { documents: [{ id: 'd', text: 'work' }], targetRole: 'Mecânico' },
      'ip',
      'key',
    ),
  ).toHaveProperty('targetRole', 'Mecânico');
});
