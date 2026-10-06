import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  installSpeechRecognition,
  MockSpeechRecognition,
} from '../../../../test/mock-speech-recognition';
import type { JobDraft } from '../_lib/job-analysis';
import { JobExampleStep, JobRecommendationsStep } from './job-example-step';
import { GUEST_ID_KEY } from '../_lib/job-analysis';

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
const originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');

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
  beforeEach(() => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    if (originalFetchDescriptor)
      Object.defineProperty(globalThis, 'fetch', originalFetchDescriptor);
    else Reflect.deleteProperty(globalThis, 'fetch');
  });

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
      expect(screen.getByRole('button', { name: /analisar e sugerir/i })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar ditado' }));
      expect(screen.getByRole('button', { name: /analisar e sugerir/i })).toBeDisabled();
      act(() => recognition.onend?.());
      expect(screen.getByLabelText('Requisitos da vaga')).toHaveValue(
        'Experiência em manutenção industrial.',
      );
      expect(screen.getByRole('button', { name: /analisar e sugerir/i })).toBeEnabled();
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
      act(() => vacancy.result(['vaga antiga']));
      expect(screen.getByLabelText('Cargo que procura')).toHaveValue('');
      fireEvent.click(screen.getByRole('button', { name: 'Falar para preencher' }));
      const role = MockSpeechRecognition.instances[1];
      act(() => role.result(['Assistente administrativo']));
      act(() => role.onend?.());
      expect(screen.getByLabelText('Cargo que procura')).toHaveValue('Assistente administrativo');
      expect(screen.getByRole('button', { name: /analisar e sugerir/i })).toBeEnabled();
      fireEvent.click(screen.getByRole('button', { name: 'Tenho uma vaga' }));
      expect(screen.getByLabelText('Requisitos da vaga')).toHaveValue('');
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

  it('shows a blocking transition while the analysis is being prepared', () => {
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

  it('uses the desired role for analysis and preserves the existing visitor identifier', async () => {
    localStorage.setItem(GUEST_ID_KEY, 'known-visitor');
    const result = { targetRole: 'Assistente administrativo' };
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'guest-token' }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => result } as Response);
    const onComplete = jest.fn();
    render(
      <JobExampleStep
        documents={[document]}
        draft={{
          ...initialDraft,
          hasJob: false,
          targetRole: 'Assistente administrativo',
          accepted: true,
        }}
        onComplete={onComplete}
        onDraftChange={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /analisar e sugerir/i }));
    await act(async () => undefined);
    expect(onComplete).toHaveBeenCalledWith(result);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
      visitorId: 'known-visitor',
      acceptedTerms: true,
      acceptedPrivacy: true,
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({
      documents: [{ id: document.id, text: document.text }],
      targetRole: 'Assistente administrativo',
    });
  });

  it('falls back to a connection notice when visitor access fails', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);
    render(
      <JobExampleStep
        documents={[document]}
        draft={{ ...initialDraft, jobText: 'Vaga', accepted: true }}
        onComplete={jest.fn()}
        onDraftChange={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /analisar e sugerir/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique sua conexão');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    [
      400,
      {
        code: 'GUEST_ANALYSIS_LIMIT_REACHED',
        message: 'Sua análise gratuita volta em até 24 horas.',
      },
      '24 horas',
    ],
    [400, { code: 'OTHER' }, '24 horas'],
    [503, { message: 'Não deve aparecer' }, 'temporariamente indisponível'],
    [500, { code: 123, message: 456 }, 'Verifique sua conexão'],
    [500, undefined, 'Verifique sua conexão'],
    [503, undefined, 'temporariamente indisponível'],
  ])(
    'preserves the failure contract for status %s and payload %j',
    async (status, payload, expected) => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accessToken: 'guest-token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status,
          json: async () => {
            if (!payload) throw new SyntaxError('No JSON');
            return payload;
          },
        } as Response);
      render(
        <JobExampleStep
          documents={[document]}
          draft={{ ...initialDraft, jobText: 'Vaga', accepted: true }}
          onComplete={jest.fn()}
          onDraftChange={jest.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /analisar e sugerir/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    },
  );
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
    fireEvent.click(screen.getByRole('radio', { name: 'Trabalhar remoto' }));
    expect(onPreferencesChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ objective: 'WORK_REMOTE' }),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Acolhedor' }));
    expect(onPreferencesChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ tone: 'WELCOMING' }),
    );
    expect(screen.getByRole('button', { name: /continuar.*em breve/i })).toBeDisabled();
  });

  it('allows editing the job when no explicit requirements were extracted', () => {
    const onEditJob = jest.fn();
    render(
      <JobRecommendationsStep
        result={{
          targetRole: 'Assistente',
          reason: 'Objetivo escolhido.',
          summary: 'Sem requisitos explícitos.',
          requirements: [],
          suggestedArchetype: 'A_FIRST_JOB',
          suggestedObjective: 'ENTER_FAST',
          suggestedTone: 'WELCOMING',
        }}
        preferences={{ archetype: 'A_FIRST_JOB', objective: 'ENTER_FAST', tone: 'WELCOMING' }}
        onEditJob={onEditJob}
        onPreferencesChange={jest.fn()}
      />,
    );
    expect(
      screen.queryByRole('list', { name: 'Requisitos principais da vaga' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar vaga' }));
    expect(onEditJob).toHaveBeenCalledTimes(1);
  });
});
