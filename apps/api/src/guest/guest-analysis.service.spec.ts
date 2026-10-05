import { GuestAnalysisService } from './guest-analysis.service';

describe('GuestAnalysisService', () => {
  const ai = { generateText: jest.fn() };
  const quota = { reserveAnalysis: jest.fn(), releaseAnalysis: jest.fn() };
  const access = { verify: jest.fn(() => ({ visitorId: 'visitor-1' })) };
  const service = new GuestAnalysisService(ai as never, quota as never, access as never);

  beforeEach(() => {
    jest.resetAllMocks();
    access.verify.mockReturnValue({ visitorId: 'visitor-1' });
  });

  it('preselects a career transition for maintenance experience targeting engineering', async () => {
    quota.reserveAnalysis.mockResolvedValue(undefined);
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
      summary: 'Encontramos 1 requisito principal para orientar seu currículo.',
    });
  });

  it('accepts JSON returned inside a markdown code fence', async () => {
    quota.reserveAnalysis.mockResolvedValue(undefined);
    ai.generateText.mockResolvedValue({
      text: '```json\n{"targetKind":"different_track","targetRole":"Engenheiro mecânico","requirements":[]}\n```',
    });

    await expect(
      service.analyze('token', {
        documents: [{ id: 'resume', text: 'Mecânico de manutenção.' }],
        jobText: 'Vaga para Engenheiro mecânico.',
      }),
    ).resolves.toMatchObject({ suggestedArchetype: 'B_CAREER_CHANGE' });
  });

  it('uses the plural form when the analysis finds multiple requirements', async () => {
    quota.reserveAnalysis.mockResolvedValue(undefined);
    ai.generateText.mockResolvedValue({
      text: JSON.stringify({
        targetKind: 'same_track',
        targetRole: 'Engenheiro de software',
        requirements: [
          { text: 'Experiência com React', category: 'ELIMINATORY' },
          { text: 'Conhecimento de GraphQL', category: 'NEGOTIABLE' },
        ],
      }),
    });

    await expect(
      service.analyze('token', {
        documents: [{ id: 'resume', text: 'Desenvolvedor React.' }],
        jobText: 'Vaga para engenheiro de software com React e GraphQL.',
      }),
    ).resolves.toMatchObject({
      summary: 'Encontramos 2 requisitos principais para orientar seu currículo.',
    });
  });

  it('releases the reservation when the AI fails so a transient error does not consume the quota', async () => {
    quota.reserveAnalysis.mockResolvedValue(undefined);
    quota.releaseAnalysis.mockResolvedValue(undefined);
    ai.generateText.mockRejectedValue(new Error('temporarily unavailable'));

    await expect(
      service.analyze('token', {
        documents: [{ id: 'resume', text: 'Experiência profissional.' }],
        jobText: 'Vaga de teste.',
      }),
    ).rejects.toThrow('temporarily unavailable');
    expect(quota.releaseAnalysis).toHaveBeenCalledWith('visitor-1', undefined);
  });
});
