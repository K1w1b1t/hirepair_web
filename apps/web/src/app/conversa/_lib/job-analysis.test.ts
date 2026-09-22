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
});
