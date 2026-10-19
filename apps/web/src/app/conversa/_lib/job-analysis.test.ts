import { deriveChoices } from './job-analysis';

describe('deriveChoices', () => {
  it('keeps all choices editable while preselecting a transition', () => {
    const result = deriveChoices({
      targetKind: 'different_track',
      targetRole: 'Engenheiro mecânico',
      requirements: [],
    });

    expect(result.selected.archetype).toBe('B_CAREER_CHANGE');
    expect(result.selected.objective).toBe('CHANGE_FIELD');
    expect(result.selected.tone).toBe('CONSULTATIVE');
    expect(result.archetypes).toHaveLength(5);
  });
  it.each([
    ['operational', 'C_OPERATIONAL', 'DIRECT'],
    ['specialist', 'E_SPECIALIST', 'TECHNICAL'],
    ['first_job', 'A_FIRST_JOB', 'DIRECT'],
    ['same_track', 'D_SAME_FIELD_RETURN', 'NEUTRAL'],
    [undefined, 'D_SAME_FIELD_RETURN', 'NEUTRAL'],
  ])('maps %s to the stable archetype and tone', (targetKind, archetype, tone) => {
    const result = deriveChoices({ targetKind, requirements: [] });

    expect(result.selected.archetype).toBe(archetype);
    expect(result.selected.tone).toBe(tone);
    expect(result.selected.objective).toBe('ENTER_FAST');
  });
});
