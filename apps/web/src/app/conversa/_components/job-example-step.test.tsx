jest.mock('../_lib/guest-api', () => ({ ...jest.requireActual('../_lib/guest-api') }));
import { preparationFixture } from '../../../../test/preparation';
jest.mock('../_lib/engine-storage', () => ({
  readEngine: jest.fn().mockResolvedValue(null),
  saveEngine: jest.fn().mockResolvedValue(undefined),
}));
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
const initialDraft = {
  objective: 'ENTER_FAST' as const,
  hasJob: true,
  jobText: '',
  targetRole: '',
  accepted: false,
};

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

  it('gates both actions by vacancy content and consent, including revocation', () => {
    render(<InteractiveJob draft={initialDraft} />);
    const analyze = screen.getByRole('button', { name: 'Analisar' });
    const skip = screen.getByRole('button', { name: 'Seguir sem vaga' });
    expect(analyze).toBeDisabled();
    expect(skip).toBeDisabled();
    expect(screen.getByText(/aceite os termos/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(skip).toBeEnabled();
    expect(
      screen.queryByText(/informe uma vaga para analisar ou siga sem vaga/i),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Requisitos da vaga'), { target: { value: '   ' } });
    expect(skip).toBeEnabled();
    expect(analyze).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Requisitos da vaga'), { target: { value: 'Vaga' } });
    expect(analyze).toBeEnabled();
    expect(skip).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(analyze).toBeDisabled();
    expect(skip).toBeDisabled();
  });

  it.each([
    ['Vaga de atendimento', 'Analisar', true],
    ['   ', 'Seguir sem vaga', false],
  ])('submits the chosen path for %s', async (jobText, action, hasJob) => {
    const originalFetch = globalThis.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'token' }) })
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetchMock });
    render(
      <InteractiveJob draft={{ ...initialDraft, jobText, accepted: true, targetRole: 'antigo' }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: action }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body).toMatchObject(hasJob ? { jobText } : { targetRole: '' });
    expect(body).not.toHaveProperty(hasJob ? 'targetRole' : 'jobText');
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
  });

  it('continues without a vacancy or documents after authorization', async () => {
    const api = jest.requireMock<typeof import('../_lib/guest-api')>('../_lib/guest-api');
    const analyze = jest
      .spyOn(api, 'analyzeGuest')
      .mockResolvedValue({ targetRole: 'Sua próxima vaga' } as never);
    const fingerprint = jest.spyOn(api, 'inputFingerprint').mockResolvedValue('hash');
    const onComplete = jest.fn();
    render(
      <JobExampleStep
        documents={[]}
        draft={{ ...initialDraft, accepted: true }}
        onComplete={onComplete}
        onDraftChange={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Seguir sem vaga' }));
    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ targetRole: 'Sua próxima vaga' }),
        expect.any(String),
      ),
    );
    analyze.mockRestore();
    fingerprint.mockRestore();
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
    fireEvent.click(screen.getByRole('button', { name: /^analisar$/i }));
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

    fireEvent.click(screen.getByRole('button', { name: /^analisar$/i }));

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

    fireEvent.click(screen.getByRole('button', { name: /^analisar$/i }));

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
    expect(screen.getAllByText('Recomendado!')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: /especialista/i })).not.toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /especialista/i }));
    expect(onPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ archetype: 'E_SPECIALIST' }),
    );
    expect(screen.getByRole('button', { name: /começar entrevista/i })).toBeEnabled();
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
    fireEvent.click(screen.getByRole('button', { name: /^analisar$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/reduza/i);
    expect(screen.getByRole('alert')).not.toHaveTextContent(/24 horas/);
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: original });
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

it('requires a declared objective and accepts a provisional decision explicitly', () => {
  const onDraftChange = jest.fn();
  render(
    <JobExampleStep
      documents={[document]}
      draft={{ ...initialDraft, objective: undefined, jobText: 'Atendimento', accepted: true }}
      onComplete={jest.fn()}
      onDraftChange={onDraftChange}
    />,
  );
  expect(screen.getByRole('button', { name: /^analisar$/i })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Seu objetivo pessoal'), {
    target: { value: 'CHANGE_FIELD' },
  });
  expect(onDraftChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ objective: 'CHANGE_FIELD' }),
  );
  fireEvent.change(screen.getByLabelText('Objetivo provisório'), { target: { value: 'yes' } });
  expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ provisional: true }));
});
it('keeps internal investigation topics out of the candidate interface', () => {
  const session = preparationFixture({
    sessionId: 's',
    funnelSessionId: 'f',
    jobText: 'Atendimento',
  }).session;
  render(
    <JobRecommendationsStep
      result={{
        preparation: session,
        targetRole: 'Atendente',
        reason: 'r',
        summary: 's',
        requirements: [],
        suggestedArchetype: 'A_FIRST_JOB',
        suggestedObjective: 'ENTER_FAST',
        suggestedTone: 'DIRECT',
      }}
      preferences={{ archetype: 'A_FIRST_JOB', objective: 'ENTER_FAST', tone: 'DIRECT' }}
      onPreferencesChange={jest.fn()}
      onEditJob={jest.fn()}
    />,
  );
  expect(
    screen.queryByRole('region', { name: 'Plano inicial de investigação' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Conte um exemplo do que você fez.')).not.toBeInTheDocument();
});
it('shows a previously confirmed provisional objective', () => {
  render(
    <JobExampleStep
      documents={[document]}
      draft={{ ...initialDraft, provisional: true }}
      onComplete={jest.fn()}
      onDraftChange={jest.fn()}
    />,
  );
  expect(screen.getByLabelText('Objetivo provisório')).toHaveValue('yes');
});
it.each(['LOCAL_STORAGE_UNAVAILABLE', 'REVISION_CONFLICT'])(
  'explains local persistence failures separately from network errors: %s',
  async (code) => {
    const storage = jest.requireMock('../_lib/engine-storage') as { readEngine: jest.Mock };
    storage.readEngine.mockRejectedValueOnce(new Error(code));
    const original = global.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: jest
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ accessToken: 'token' }) }),
    });
    render(
      <JobExampleStep
        documents={[document]}
        draft={{ ...initialDraft, jobText: 'Atendimento', accepted: true }}
        onComplete={jest.fn()}
        onDraftChange={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^analisar$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      code === 'LOCAL_STORAGE_UNAVAILABLE' ? 'A retomada não está garantida' : 'mudou em outra aba',
    );
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: original });
  },
);

it('does not expose an unexpected non-Error failure as personal content', async () => {
  const storage = jest.requireMock('../_lib/engine-storage') as { readEngine: jest.Mock };
  storage.readEngine.mockRejectedValueOnce('unexpected private content');
  const original = global.fetch;
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: jest.fn().mockResolvedValue({ ok: true, json: async () => ({ accessToken: 'token' }) }),
  });
  render(
    <JobExampleStep
      documents={[document]}
      draft={{ ...initialDraft, jobText: 'Atendimento', accepted: true }}
      onComplete={jest.fn()}
      onDraftChange={jest.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /^analisar$/i }));
  expect(await screen.findByRole('alert')).not.toHaveTextContent('unexpected private content');
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: original });
});
