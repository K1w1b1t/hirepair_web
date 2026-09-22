import { act, fireEvent, render, screen } from '@testing-library/react';
import { JobExampleStep, JobRecommendationsStep } from './job-example-step';

const document = {
  id: 'resume',
  text: 'Mecânico de manutenção',
  fileName: 'curriculo.txt',
  source: 'pasted' as const,
  fileType: 'TXT' as const,
  findings: [],
  createdAt: 1,
};
const initialDraft = { hasJob: true, jobText: '', targetRole: '', accepted: false };

describe('JobExampleStep', () => {
  it('keeps analysis disabled until the vacancy and legal acceptance are present', () => {
    const onDraftChange = jest.fn();
    const { rerender } = render(
      <JobExampleStep
        documents={[document]}
        draft={initialDraft}
        onComplete={jest.fn()}
        onDraftChange={onDraftChange}
      />,
    );
    const button = screen.getByRole('button', { name: /analisar e sugerir/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', expect.stringMatching(/informe os requisitos/i));
    fireEvent.change(screen.getByLabelText(/requisitos da vaga/i), {
      target: { value: 'Engenheiro mecânico' },
    });
    expect(onDraftChange).toHaveBeenCalledWith({ ...initialDraft, jobText: 'Engenheiro mecânico' });
    rerender(
      <JobExampleStep
        documents={[document]}
        draft={{ ...initialDraft, jobText: 'Engenheiro mecânico', accepted: true }}
        onComplete={jest.fn()}
        onDraftChange={onDraftChange}
      />,
    );
    expect(button).toBeEnabled();
  });

  it('links legal documents and shows network failures only in a temporary notification', async () => {
    jest.useFakeTimers();
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: jest.fn().mockRejectedValue(new TypeError('NetworkError')),
    });
    render(
      <JobExampleStep
        documents={[document]}
        draft={{ ...initialDraft, jobText: 'Engenheiro', accepted: true }}
        onComplete={jest.fn()}
        onDraftChange={jest.fn()}
      />,
    );
    expect(screen.getByRole('link', { name: 'Termos' })).toHaveClass('job-terms-link');
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute(
      'href',
      '/legal#privacy',
    );
    fireEvent.click(screen.getByRole('button', { name: /analisar e sugerir/i }));
    expect(await screen.findByRole('alert')).not.toHaveTextContent('NetworkError');
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
    jest.useRealTimers();
  });
});

describe('JobRecommendationsStep', () => {
  it('marks automatic choices as recommended while keeping alternatives editable', () => {
    const onPreferencesChange = jest.fn();
    render(
      <JobRecommendationsStep
        result={{
          targetRole: 'Engenheiro mecânico',
          reason: 'Transição detectada.',
          summary: 'Encontramos 1 requisito principal.',
          requirements: [{ text: 'Graduação', category: 'ELIMINATORY' }],
          suggestedArchetype: 'B_CAREER_CHANGE',
          suggestedObjective: 'CHANGE_FIELD',
          suggestedTone: 'CONSULTATIVE',
        }}
        preferences={{
          archetype: 'B_CAREER_CHANGE',
          objective: 'CHANGE_FIELD',
          tone: 'CONSULTATIVE',
        }}
        onEditJob={jest.fn()}
        onPreferencesChange={onPreferencesChange}
      />,
    );
    expect(screen.getByText('Engenheiro mecânico')).toBeInTheDocument();
    expect(screen.getAllByText('Recomendado')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /especialista/i })).not.toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /especialista/i }));
    expect(onPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ archetype: 'E_SPECIALIST' }),
    );
    expect(screen.getByRole('button', { name: /continuar.*em breve/i })).toBeDisabled();
  });
});
