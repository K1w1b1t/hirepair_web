import { serialize, deserialize } from 'node:v8';
Object.defineProperty(globalThis, 'structuredClone', {
  configurable: true,
  value: (v: unknown) => deserialize(serialize(v)),
});
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  createSession,
  startWithoutDocuments,
  startGuided,
  guidedAnswer,
  guidedQuestion,
  type Session,
} from '@hirepair/interview-engine';
import { InterviewWorkspace } from './interview-workspace';
import { captureAnalyticsEvent } from '../../../analytics/analytics';
import { analyzeInterviewBlock, hasInterviewAccess, AnalysisFailure } from '../_lib/guest-api';
import { commitInterview } from '../_lib/interview-session';
import { useGuidedVoice } from './use-guided-voice';
let hash = 0;
jest.mock('../_lib/interview-session', () => ({
  hashValue: async () => `h${hash++}`,
  commitInterview: jest.fn(async (s, _payload, fn) => ({
    ...fn(structuredClone(s), `h${hash++}`),
    revision: s.revision + 1,
  })),
}));
jest.mock('../_lib/guest-api', () => ({
  hasInterviewAccess: jest.fn(() => true),
  analyzeInterviewBlock: jest.fn(),
  finishInterviewRequest: jest.fn(),
  cancelPreparation: jest.fn(),
  AnalysisFailure: class extends Error {},
}));
jest.mock('../../../analytics/analytics', () => ({ captureAnalyticsEvent: jest.fn() }));
jest.mock('./use-guided-voice', () => ({
  useGuidedVoice: jest.fn(() => ({
    status: 'idle',
    notice: '',
    microphone: jest.fn(),
    pause: jest.fn(),
    replaceDraft: jest.fn(),
  })),
}));
jest.mock('./turnstile-challenge', () => ({
  TurnstileChallenge: ({ onReady }: { onReady: (value: unknown) => void }) => (
    <input aria-label="Verificação de acesso" onChange={() => onReady({ token: 'captcha' })} />
  ),
}));
function initial() {
  const s = createSession('s', 'f', { resumes: 'r', job: 'j', objective: 'o', facts: 'f' });
  s.objective = { value: 'ENTER_FAST', provisional: false };
  return startWithoutDocuments(s);
}
function Harness({ session = initial() }: { session?: Session }) {
  const [s, set] = useState(session);
  return (
    <>
      <InterviewWorkspace
        session={s}
        draft={{ hasJob: false, jobText: '', targetRole: 'Atendente', accepted: true }}
        onChange={set}
      />
      <output data-testid="state">{JSON.stringify(s)}</output>
    </>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  (hasInterviewAccess as jest.Mock).mockReturnValue(true);
  (useGuidedVoice as jest.Mock).mockReturnValue({
    status: 'idle',
    notice: '',
    pause: jest.fn(),
    microphone: jest.fn(),
    replaceDraft: jest.fn(),
  });
  Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: () => {} });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: true }),
  });
  (analyzeInterviewBlock as jest.Mock).mockImplementation(async (request) => {
    const t = request.turns[0],
      origin = { sourceId: t.id, sourceVersion: 'v', quote: t.text };
    return {
      version: 1,
      revision: request.revision,
      extraction: {
        experiences: request.context.experiences.length
          ? []
          : [
              {
                id: 'e',
                title: 'Atividade informal',
                start: null,
                end: null,
                current: null,
                origin,
              },
            ],
        facts: [{ id: `f-${t.id}`, experienceId: 'e', text: t.text, origin }],
      },
      analysis: null,
      assessments: request.topics.map((topic: { id: string }) => ({
        topicId: topic.id,
        sufficient: true,
        evidence: ['atividade'],
        question: null,
        contradictionFactIds: [],
      })),
    };
  });
});
function pendingSession(count = 3) {
  let s = startGuided(initial());
  for (let i = 0; i < count; i++) {
    const q = guidedQuestion(s)!;
    s = guidedAnswer(s, {
      id: `t${i}`,
      question: { text: q.text, topicId: q.topic.id },
      answer: { text: 'Atendi clientes na feira.', kind: 'specific' },
      factIds: [],
    });
  }
  return s;
}
it('records unknown, forgotten and absent responses without creating positive facts', async () => {
  render(<Harness />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  for (const [answer, kind] of [
    ['Não sei', 'unknown'],
    ['Não lembro', 'forgotten'],
    ['Não tenho', 'absence'],
  ]) {
    fireEvent.change(screen.getByLabelText('Sua resposta'), { target: { value: answer } });
    fireEvent.click(screen.getByText('Enviar resposta'));
    await waitFor(() =>
      expect(screen.getByTestId('state').textContent).toContain(`"kind":"${kind}"`),
    );
  }
  expect(analyzeInterviewBlock).not.toHaveBeenCalled();
});
it('accepts a spoken or typed request to stop without adding a stop button', async () => {
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('Sua resposta'), { target: { value: 'Quero parar' } });
  fireEvent.click(screen.getByText('Enviar resposta'));
  await screen.findByText('Suas respostas estão salvas');
  expect(analyzeInterviewBlock).not.toHaveBeenCalled();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('announces save failure and preserves the draft for resubmission', async () => {
  (commitInterview as jest.Mock).mockRejectedValueOnce(new Error('storage'));
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('Sua resposta'), { target: { value: 'Minha atividade' } });
  fireEvent.click(screen.getByText('Enviar resposta'));
  expect(await screen.findByRole('alert')).toHaveTextContent('não foi salva');
  expect(screen.getByLabelText('Sua resposta')).toHaveValue('Minha atividade');
});
it('renews access before automatic extraction and surfaces a typed service failure', async () => {
  (hasInterviewAccess as jest.Mock).mockReturnValue(false);
  (analyzeInterviewBlock as jest.Mock).mockRejectedValueOnce(
    new AnalysisFailure('Cota indisponível'),
  );
  render(<Harness session={pendingSession()} />);
  expect(analyzeInterviewBlock).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Verificação de acesso'), { target: { value: 'ok' } });
  await screen.findByText('Suas respostas estão salvas');
  expect(screen.getByText('Cota indisponível')).toBeInTheDocument();
  expect(analyzeInterviewBlock).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
    token: 'captcha',
  });
});
it('counts active interview time, ignores hidden time and completes a reached limit locally', async () => {
  jest.useFakeTimers();
  const s = startGuided(initial());
  s.guided!.activeMs = 475000;
  const view = render(<Harness session={s} />);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  await act(async () => jest.advanceTimersByTime(5000));
  expect(commitInterview).not.toHaveBeenCalled();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  await act(async () => jest.advanceTimersByTime(5000));
  expect(screen.getByText('Suas respostas estão salvas')).toBeInTheDocument();
  expect(analyzeInterviewBlock).not.toHaveBeenCalled();
  view.unmount();
  jest.useRealTimers();
});
it('does not publish a late provider response after unmount', async () => {
  let resolve!: (value: unknown) => void;
  (analyzeInterviewBlock as jest.Mock).mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const changed = jest.fn();
  const view = render(
    <InterviewWorkspace
      session={pendingSession()}
      draft={{ hasJob: true, jobText: 'Atendimento', targetRole: 'Atendente', accepted: true }}
      onChange={changed}
    />,
  );
  await waitFor(() => expect(analyzeInterviewBlock).toHaveBeenCalled());
  view.unmount();
  await act(async () => resolve({}));
  expect(changed).not.toHaveBeenCalled();
});
it.each(['speaking', 'listening', 'preview', 'idle'])(
  'announces voice status %s with two controls',
  async (status) => {
    (useGuidedVoice as jest.Mock).mockReturnValue({
      status,
      notice: 'Aviso do áudio',
      pause: jest.fn(),
      microphone: jest.fn(),
      replaceDraft: jest.fn(),
    });
    const s = startGuided(initial());
    s.guided!.answered = [
      'guided:activity',
      'guided:context',
      'guided:period',
      'guided:responsibility',
      'guided:tools',
      'guided:frequency',
    ];
    render(
      <InterviewWorkspace
        session={s}
        draft={{ hasJob: false, jobText: '', targetRole: 'Atendente', accepted: true }}
        onChange={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Falar'));
    expect(screen.getAllByRole('button')).toHaveLength(2);
  },
);
it('starts with the microphone on mobile and records automatic dictation in the same contract', async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false }),
  });
  render(<Harness />);
  expect(screen.getByRole('button', { name: 'Ouvir e responder' })).toBeInTheDocument();
  const callback = (useGuidedVoice as jest.Mock).mock.calls.at(-1)![2] as (v: string) => void;
  await act(async () => callback('Organizei inscrições'));
  expect(JSON.parse(screen.getByTestId('state').textContent!).turns[0].modality).toBe('dictation');
});
it('ignores duplicate and empty submissions and cannot submit after the interview ends', async () => {
  let resolve!: () => void;
  (commitInterview as jest.Mock).mockImplementationOnce(
    (s, _payload, fn) =>
      new Promise((r) => {
        resolve = () => r({ ...fn(structuredClone(s), 'hash'), revision: s.revision + 1 });
      }),
  );
  render(<Harness />);
  const callback = (useGuidedVoice as jest.Mock).mock.calls.at(-1)![2] as (v: string) => void;
  act(() => {
    callback('');
    callback('Primeira resposta');
    callback('Duplicada');
  });
  expect(commitInterview).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
  expect(JSON.parse(screen.getByTestId('state').textContent!).turns).toHaveLength(1);
});
it('serializes an audio response behind an in-flight clock save', async () => {
  jest.useFakeTimers();
  let release!: () => void;
  (commitInterview as jest.Mock).mockImplementationOnce(
    (s, _payload, fn) =>
      new Promise((r) => {
        release = () => r({ ...fn(structuredClone(s), 'hash'), revision: s.revision + 1 });
      }),
  );
  const view = render(<Harness />);
  act(() => jest.advanceTimersByTime(5000));
  const callback = (useGuidedVoice as jest.Mock).mock.calls.at(-1)![2] as (v: string) => void;
  act(() => callback('Resposta depois do relógio'));
  expect(commitInterview).toHaveBeenCalledTimes(1);
  await act(async () => release());
  expect(JSON.parse(screen.getByTestId('state').textContent!).turns).toHaveLength(1);
  view.unmount();
  jest.useRealTimers();
});
it('keeps a saved answer safe when its write resolves after unmount', async () => {
  let release!: () => void;
  (commitInterview as jest.Mock).mockImplementationOnce(
    (s, _payload, fn) =>
      new Promise((r) => {
        release = () => r({ ...fn(structuredClone(s), 'hash'), revision: s.revision + 1 });
      }),
  );
  const changed = jest.fn();
  const view = render(
    <InterviewWorkspace
      session={initial()}
      draft={{ hasJob: false, jobText: '', targetRole: 'Atendente', accepted: true }}
      onChange={changed}
    />,
  );
  const callback = (useGuidedVoice as jest.Mock).mock.calls.at(-1)![2] as (v: string) => void;
  act(() => callback('Minha resposta'));
  view.unmount();
  await act(async () => release());
  await act(async () => callback('Tardia'));
  expect(changed).not.toHaveBeenCalled();
});
it('announces a clock persistence error without erasing the interview', async () => {
  jest.useFakeTimers();
  (commitInterview as jest.Mock).mockRejectedValueOnce(new Error('storage'));
  const view = render(<Harness />);
  await act(async () => jest.advanceTimersByTime(5000));
  expect(screen.getByRole('alert')).toHaveTextContent('salvar seu progresso');
  view.unmount();
  jest.useRealTimers();
});
it('ignores late input after a local limit and a failed write after unmount', async () => {
  const limited = startGuided(initial());
  limited.guided!.activeMs = 480000;
  const view = render(<Harness session={limited} />);
  await screen.findByText('Suas respostas estão salvas');
  const callback = (useGuidedVoice as jest.Mock).mock.calls.at(-1)![2] as (v: string) => void;
  await act(async () => callback('Resposta tardia'));
  expect(JSON.parse(screen.getByTestId('state').textContent!).turns).toHaveLength(0);
  view.unmount();
  let fail!: (e: Error) => void;
  (commitInterview as jest.Mock).mockImplementationOnce(
    () =>
      new Promise((_r, reject) => {
        fail = reject;
      }),
  );
  const other = render(<Harness />);
  const next = (useGuidedVoice as jest.Mock).mock.calls.at(-1)![2] as (v: string) => void;
  act(() => next('Resposta'));
  other.unmount();
  await act(async () => fail(new Error('storage')));
});
it('keeps investigating the last unresolved topic before finalizing a long interview', async () => {
  const s = pendingSession();
  s.guided!.answered.push(...Array(5).fill('guided:activity'));
  const implementation = (analyzeInterviewBlock as jest.Mock).getMockImplementation()!;
  (analyzeInterviewBlock as jest.Mock).mockImplementationOnce(async (req) => {
    const value = await implementation(req);
    value.assessments[0] = {
      ...value.assessments[0],
      sufficient: false,
      question: 'Qual foi sua participação nessa atividade?',
    };
    return value;
  });
  render(<Harness session={s} />);
  expect(await screen.findByText('Qual foi sua participação nessa atividade?')).toBeInTheDocument();
  expect(screen.queryByText('Entrevista concluída')).not.toBeInTheDocument();
});
it('shows one question and at most two controls, then organizes answers without manual analysis or review', async () => {
  render(<Harness />);
  expect(screen.getAllByRole('button')).toHaveLength(2);
  expect(screen.queryByText('Analisar este bloco')).not.toBeInTheDocument();
  for (let i = 0; i < 8; i++) {
    const input = screen.queryByLabelText('Sua resposta');
    if (!input) break;
    fireEvent.change(input, { target: { value: `Eu conferia inscrições da feira escolar ${i}.` } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta' }));
    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('state').textContent!).turns).toHaveLength(i + 1),
    );
    await waitFor(() =>
      expect(screen.queryByText('Organizando sua resposta…')).not.toBeInTheDocument(),
    );
  }
  await screen.findByText('Entrevista concluída');
  expect(screen.queryByText('O que você quer manter?')).not.toBeInTheDocument();
  const state = JSON.parse(screen.getByTestId('state').textContent!) as Session;
  expect(state.selection?.kind).toBe('engine');
  expect(state.confirmation).toBeNull();
  expect(state.facts.every((f) => f.confirmation === 'candidate')).toBe(true);
  expect(captureAnalyticsEvent).toHaveBeenCalledWith('interview_completed', {
    funnel_session_id: 'f',
  });
  expect(captureAnalyticsEvent).not.toHaveBeenCalledWith('facts_confirmed', expect.anything());
});
it('retains the story and reports a partial outcome instead of claiming provider success', async () => {
  (analyzeInterviewBlock as jest.Mock).mockRejectedValueOnce(new Error('capacity'));
  render(<Harness />);
  for (let i = 0; i < 3; i++) {
    fireEvent.change(screen.getByLabelText('Sua resposta'), {
      target: { value: 'Atendi clientes na feira.' },
    });
    fireEvent.click(screen.getByText('Enviar resposta'));
    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('state').textContent!).turns).toHaveLength(i + 1),
    );
  }
  await screen.findByText('Suas respostas estão salvas');
  expect(screen.queryByText('Entrevista concluída')).not.toBeInTheDocument();
  expect(captureAnalyticsEvent).not.toHaveBeenCalled();
});
it('offers voice as a secondary mode without exposing review or navigation actions', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByText('Falar'));
  await act(async () => {});
  expect(screen.getByText('Escrever')).toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(2);
  fireEvent.click(screen.getByText('Escrever'));
  expect(screen.getByLabelText('Sua resposta')).toBeInTheDocument();
});
