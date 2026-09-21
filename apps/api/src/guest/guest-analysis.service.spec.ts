import { GuestAnalysisService } from './guest-analysis.service';

describe('GuestAnalysisService', () => {
  const ai = { generateText: jest.fn() };
  const quota = { consumeAnalysis: jest.fn() };
  const access = { verify: jest.fn(() => ({ visitorId: 'visitor-1' })) };
  const service = new GuestAnalysisService(ai as never, quota as never, access as never);

  beforeEach(() => {
    jest.resetAllMocks();
    access.verify.mockReturnValue({ visitorId: 'visitor-1' });
  });

  it('preselects a career transition for maintenance experience targeting engineering', async () => {
    quota.consumeAnalysis.mockResolvedValue(undefined);
    ai.generateText.mockResolvedValue({
      text: JSON.stringify({
        targetKind: 'different_track',
        targetRole: 'Engenheiro mecânico',
        requirements: [{ text: 'Graduação em Engenharia', category: 'ELIMINATORY' }],
      }),
    });

    await expect(
      service.analyze('token', {
        documents: [{ id: 'resume', text: 'Mecânico de manutenção industrial por 5 anos.' }],
        jobText: 'Vaga para Engenheiro mecânico. Graduação em Engenharia obrigatória.',
      }),
    ).resolves.toMatchObject({
      suggestedArchetype: 'B_CAREER_CHANGE',
      suggestedObjective: 'CHANGE_FIELD',
      suggestedTone: 'CONSULTATIVE',
    });
  });
});
