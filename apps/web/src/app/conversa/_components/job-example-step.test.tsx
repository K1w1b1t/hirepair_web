jest.mock('./turnstile-challenge', () => ({
  TurnstileChallenge: ({
    onReady,
  }: {
    onReady: (challenge: { token: string; termsVersion: string; privacyVersion: string }) => void;
  }) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => {
      onReady({ token: 'challenge', termsVersion: '2026-10-07', privacyVersion: '2026-10-07' });
    }, [onReady]);
    return null;
  },
}));
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import {
  installSpeechRecognition,
  MockSpeechRecognition,
} from '../../../../test/mock-speech-recognition';
import type { JobDraft } from '../_lib/job-analysis';
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

function InteractiveJob({ draft: initial }: { draft: JobDraft }) {
  const [draft, setDraft] = useState(initial);
  return (
    <JobExampleStep
      documents={[document]}
      draft={draft}
      onComplete={jest.fn()}
      onDraftChange={setDraft}
    />
  );
}

describe('JobExampleStep', () => {
  it('dictates vacancy requirements and preserves legal acceptance changed during speech', () => {
    const restore = installSpeechRecognition();
    try {
      render(<InteractiveJob draft={initialDraft} />);
      fireEvent.click(screen.getByRole('button', { name: 'Falar para preencher' }));
      const recognition = MockSpeechRecognition.instances[0];
      act(() => recognition.onstart?.());
      fireEvent.click(screen.getByRole('checkbox'));
      act(() => recognition.result(['Experiência em manutenção industrial.']));
      expect(screen.getByRole('checkbox')).toBeChecked();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar ditado' }));
      act(() => recognition.onend?.());
      expect(screen.getByLabelText('Requisitos da vaga')).toHaveValue(
        'Experiência em manutenção industrial.',
      );
    } finally {
      restore();
    }
  });

  it('aborts vacancy speech on mode change and dictates the desired role independently', () => {
    const restore = installSpeechRecognition(true);
    try {
      render(<InteractiveJob draft={{ ...initialDraft, accepted: true }} />);
      fireEvent.click(screen.getByRole('button', { name: 'Falar para preencher' }));
      const vacancy = MockSpeechRecognition.instances[0];
      fireEvent.click(screen.getByRole('button', { name: 'Ainda não tenho' }));
      expect(vacancy.abort).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: 'Falar para preencher' }));
      const role = MockSpeechRecognition.instances[1];
      act(() => role.result(['Assistente administrativo']));
      act(() => role.onend?.());
      expect(screen.getByLabelText('Cargo que procura')).toHaveValue('Assistente administrativo');
    } finally {
      restore();
    }
  });

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

  it('shows a blocking transition while the analysis is being prepared', async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: jest.fn(() => new Promise(() => undefined)),
    });
    render(
      <JobExampleStep
        documents={[document]}
        draft={{ ...initialDraft, jobText: 'Engenheiro', accepted: true }}
        onComplete={jest.fn()}
        onDraftChange={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /analisar e sugerir/i }));

    expect(screen.getByRole('dialog', { name: /preparando suas sugestões/i })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByText(/isso pode levar alguns segundos/i)).toBeInTheDocument();
    expect(screen.getByTestId('analysis-spinner')).toBeInTheDocument();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
  });

  it('explains when the AI provider has reached its temporary limit', async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'token' }) })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({
            code: 'AI_CAPACITY_EXHAUSTED',
            message: 'A capacidade gratuita da IA foi atingida. Tente novamente mais tarde.',
          }),
        }),
    });
    render(
      <JobExampleStep
        documents={[document]}
        draft={{ ...initialDraft, jobText: 'Engenheiro', accepted: true }}
        onComplete={jest.fn()}
        onDraftChange={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /analisar e sugerir/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A capacidade gratuita da IA foi atingida. Tente novamente mais tarde.',
    );
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
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
    expect(screen.getAllByText('Recomendado!')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /especialista/i })).not.toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /especialista/i }));
    expect(onPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ archetype: 'E_SPECIALIST' }),
    );
    expect(screen.getByRole('button', { name: /continuar.*em breve/i })).toBeDisabled();
  });
});

describe('analysis error codes', () => {
  it('does not describe input validation as a daily quota', async () => {
    const original = globalThis.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'token' }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ code: 'AI_INPUT_TOO_LARGE' }),
      });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetchMock });
    render(
      <JobExampleStep
        documents={[document]}
        draft={{ ...initialDraft, jobText: 'Vaga', accepted: true }}
        onComplete={jest.fn()}
        onDraftChange={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /analisar e sugerir/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/reduza/i);
    expect(screen.getByRole('alert')).not.toHaveTextContent(/24 horas/);
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: original });
  });
});

it('switches between vacancy and target-role inputs with precise consent guidance', () => {
  const onDraftChange = jest.fn();
  const props = { documents: [document], onComplete: jest.fn(), onDraftChange };
  const view = render(<JobExampleStep {...props} draft={initialDraft} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ainda não tenho' }));
  expect(onDraftChange).toHaveBeenLastCalledWith({ ...initialDraft, hasJob: false });
  view.rerender(
    <JobExampleStep {...props} draft={{ ...initialDraft, hasJob: false, accepted: true }} />,
  );
  expect(screen.getByRole('button', { name: /analisar e sugerir/i })).toHaveAttribute(
    'title',
    'Informe os requisitos da vaga para analisar.',
  );
  fireEvent.change(screen.getByLabelText('Cargo que procura'), { target: { value: 'Mecânico' } });
  expect(onDraftChange).toHaveBeenLastCalledWith({
    ...initialDraft,
    hasJob: false,
    accepted: true,
    targetRole: 'Mecânico',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Tenho uma vaga' }));
  view.rerender(<JobExampleStep {...props} draft={{ ...initialDraft, jobText: 'Vaga' }} />);
  expect(screen.getByRole('button', { name: /analisar e sugerir/i })).toHaveAttribute(
    'title',
    'Aceite os Termos e a Política de Privacidade para analisar.',
  );
  fireEvent.click(screen.getByRole('checkbox'));
  expect(onDraftChange).toHaveBeenLastCalledWith({
    ...initialDraft,
    jobText: 'Vaga',
    accepted: true,
  });
});
it('edits goal and tone and shows no requirement list for an empty result', () => {
  const onPreferencesChange = jest.fn(),
    onEditJob = jest.fn();
  render(
    <JobRecommendationsStep
      result={{
        targetRole: 'Mecânico',
        reason: 'r',
        summary: 's',
        suggestedArchetype: 'C_OPERATIONAL',
        suggestedObjective: 'ENTER_FAST',
        suggestedTone: 'DIRECT',
        requirements: [],
      }}
      preferences={{ archetype: 'C_OPERATIONAL', objective: 'ENTER_FAST', tone: 'DIRECT' }}
      onPreferencesChange={onPreferencesChange}
      onEditJob={onEditJob}
    />,
  );
  const radios = screen.getAllByRole('radio');
  for (const radio of radios) fireEvent.click(radio);
  expect(onPreferencesChange).toHaveBeenCalledWith(expect.objectContaining({ tone: 'NEUTRAL' }));
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Editar vaga' }));
  expect(onEditJob).toHaveBeenCalled();
});
