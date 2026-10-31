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
  requestReview,
  prepare,
  type Session,
} from '@hirepair/interview-engine';
import { InterviewWorkspace } from './interview-workspace';
import { extraction, analysis } from '../../../../../../packages/interview-engine/src/fixtures';
import { commitInterview } from '../_lib/interview-session';
import { analyzeInterviewBlock } from '../_lib/guest-api';
import { captureAnalyticsEvent } from '../../../analytics/analytics';
jest.mock('../_lib/interview-session', () => ({
  hashValue: jest.fn().mockImplementation(async () => crypto.randomUUID()),
  commitInterview: jest.fn(async (s, _p, fn) => fn(structuredClone(s), crypto.randomUUID())),
}));
jest.mock('../_lib/guest-api', () => ({
  hasInterviewAccess: jest.fn().mockReturnValue(true),
  analyzeInterviewBlock: jest.fn(),
  finishInterviewRequest: jest.fn(),
  cancelPreparation: jest.fn(),
  AnalysisFailure: class extends Error {},
}));
jest.mock('../../../analytics/analytics', () => ({ captureAnalyticsEvent: jest.fn() }));
jest.mock('./header-profile', () => ({ HeaderProfile: () => <div>Perfil local</div> }));
jest.mock('./turnstile-challenge', () => ({
  TurnstileChallenge: ({
    onReady,
  }: {
    onReady: (value: { token: string; termsVersion: string; privacyVersion: string }) => void;
  }) => (
    <button onClick={() => onReady({ token: 'verified', termsVersion: 'v', privacyVersion: 'v' })}>
      Verificação
    </button>
  ),
}));
jest.mock('./voice-text-field', () => ({
  VoiceTextField: ({
    value,
    onChange,
    onBusyChange,
  }: {
    value: string;
    onChange: (s: string) => void;
    onBusyChange: (b: boolean) => void;
  }) => (
    <>
      <textarea
        id="interview-answer"
        aria-label="Sua resposta"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        onClick={() => {
          onBusyChange(true);
          onChange('Transcrição para corrigir');
          onBusyChange(false);
        }}
      >
        Ditar
      </button>
    </>
  ),
}));
function initial() {
  const s = createSession('s', 'funnel', { resumes: '', job: 'j', objective: 'o', facts: '' });
  s.objective = { value: 'ENTER_FAST', provisional: false };
  return startWithoutDocuments(s);
}
function Harness({ initialSession = initial() }: { initialSession?: Session }) {
  const [s, set] = useState(initialSession);
  return (
    <>
      <InterviewWorkspace
        session={s}
        draft={{ hasJob: false, targetRole: 'Atendente', jobText: '', accepted: true }}
        onChange={set}
      />
      <output data-testid="state">{JSON.stringify(s)}</output>
    </>
  );
}
function state(): Session {
  return JSON.parse(screen.getByTestId('state').textContent!);
}
beforeEach(() => {
  jest.clearAllMocks();
});
it('asks one question, lets the person correct dictation, and records only on explicit send', async () => {
  render(<Harness />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  fireEvent.click(screen.getByText('Ditar'));
  expect(state().turns).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Sua resposta'), {
    target: { value: 'Conferia entradas na loja' },
  });
  fireEvent.click(screen.getByText('Enviar resposta'));
  await waitFor(() => expect(state().turns).toHaveLength(1));
  expect(state().turns[0]).toMatchObject({
    modality: 'dictation',
    answer: { text: 'Conferia entradas na loja' },
  });
  expect(screen.getByRole('heading', { name: /Onde foi/ })).toBeInTheDocument();
  expect(captureAnalyticsEvent).not.toHaveBeenCalled();
});
it('supports valid exits, pause, resume and partial review without inventing facts', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByText('Pausar conversa'));
  await screen.findByText('Retomar conversa');
  fireEvent.click(screen.getByText('Retomar conversa'));
  await screen.findByText('Não lembro');
  fireEvent.click(screen.getByText('Não lembro'));
  await screen.findByRole('heading', { name: 'O que você quer manter?' });
  expect(state().interview!.topics.discovery.status).toBe('forgotten');
  expect(state().facts).toEqual([]);
  expect(screen.getByText('Confirmar os fatos que quero manter')).toBeDisabled();
  fireEvent.click(screen.getByText('Voltar à conversa'));
  await screen.findByLabelText('Sua resposta');
  fireEvent.click(screen.getByText('Encerrar conversa e revisar'));
  await screen.findByText('O que você quer manter?');
});
it('edits, explicitly keeps and confirms the selected current versions, emitting only on success', async () => {
  const s = requestReview(prepare({ ...initial(), phase: 'preparation' }, extraction, analysis));
  render(<Harness initialSession={s} />);
  expect(captureAnalyticsEvent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Editar este fato'));
  fireEvent.change(screen.getByLabelText('Corrigir fato'), {
    target: { value: 'Conferia as entradas na loja.' },
  });
  fireEvent.click(screen.getByText('Salvar correção'));
  await waitFor(() => expect(state().facts[0].revision).toBe(2));
  expect(state().facts[0].confirmation).toBe('candidate');
  fireEvent.click(screen.getByText('Manter este fato'));
  await waitFor(() => expect(state().facts[0].confirmation).toBe('confirmed'));
  fireEvent.click(screen.getByText('Confirmar os fatos que quero manter'));
  await screen.findByRole('heading', { name: 'Fatos confirmados para preparar seu currículo' });
  expect(state().confirmation!.factIds).toEqual(['f']);
  expect(captureAnalyticsEvent).toHaveBeenCalledTimes(1);
  expect(captureAnalyticsEvent).toHaveBeenCalledWith('facts_confirmed', {
    funnel_session_id: 'funnel',
  });
});
it('removes facts and blocks generation from the rejected set', async () => {
  render(
    <Harness
      initialSession={requestReview(
        prepare({ ...initial(), phase: 'preparation' }, extraction, analysis),
      )}
    />,
  );
  fireEvent.click(screen.getByText('Remover este fato'));
  await waitFor(() => expect(state().facts[0].confirmation).toBe('rejected'));
  expect(screen.getByText('Confirmar os fatos que quero manter')).toBeDisabled();
  expect(screen.getByText(/Este fato será removido/)).toBeInTheDocument();
});
it('preserves the answer when saving fails and announces the failure', async () => {
  (commitInterview as jest.Mock).mockRejectedValueOnce(new Error('REVISION_CONFLICT'));
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('Sua resposta'), { target: { value: 'Atendi clientes' } });
  fireEvent.click(screen.getByText('Enviar resposta'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar');
  expect(screen.getByLabelText('Sua resposta')).toHaveValue('Atendi clientes');
});
it('preserves collected history when the provider fails and allows partial review', async () => {
  (analyzeInterviewBlock as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('Sua resposta'), { target: { value: 'Atendi clientes' } });
  fireEvent.click(screen.getByText('Enviar resposta'));
  await screen.findByText('Analisar este bloco');
  fireEvent.click(screen.getByText('Analisar este bloco'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Seus relatos foram preservados');
  expect(state().turns).toHaveLength(1);
  fireEvent.click(screen.getByText('Encerrar conversa e revisar'));
  await screen.findByText('O que você quer manter?');
});
it('counts only visible interview time and does not count review time', async () => {
  jest.useFakeTimers();
  render(<Harness />);
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  expect(state().interview!.activeMs).toBe(5000);
  fireEvent.click(screen.getByText('Encerrar conversa e revisar'));
  await act(async () => {});
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  expect(state().interview!.activeMs).toBe(5000);
  jest.useRealTimers();
});
import { hasInterviewAccess, AnalysisFailure } from '../_lib/guest-api';
it('analyzes a collected block into the same candidate contract and presents review', async () => {
  (analyzeInterviewBlock as jest.Mock).mockImplementationOnce(async (request) => {
    const t = request.turns[0];
    const origin = { sourceId: t.id, sourceVersion: 'hash', quote: t.text };
    return {
      version: 1,
      revision: request.revision,
      extraction: {
        experiences: [
          { id: 'e', title: 'Projeto informal', start: null, end: null, current: null, origin },
        ],
        facts: [{ id: 'f', experienceId: 'e', text: t.text, origin }],
      },
      analysis: null,
      assessments: [
        {
          topicId: 'discovery',
          sufficient: true,
          evidence: ['atividade'],
          question: null,
          contradictionFactIds: [],
        },
      ],
    };
  });
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('Sua resposta'), {
    target: { value: 'Organizei inscrições na feira escolar' },
  });
  fireEvent.click(screen.getByText('Enviar resposta'));
  await screen.findByText('Analisar este bloco');
  fireEvent.click(screen.getByText('Analisar este bloco'));
  await screen.findByText('O que você quer manter?');
  expect(state().facts[0].confirmation).toBe('candidate');
  expect(state().stories[0].turnId).toBe(state().turns[0].id);
  expect(screen.getByText('Período não informado')).toBeInTheDocument();
  expect(captureAnalyticsEvent).not.toHaveBeenCalled();
});
it('sends only active facts as context and allows explicit access renewal', async () => {
  (hasInterviewAccess as jest.Mock).mockReturnValue(false);
  const s = prepare({ ...initial(), phase: 'preparation' }, extraction, analysis);
  s.facts.push({ ...s.facts[0], id: 'removed', confirmation: 'rejected' });
  s.turns = [
    {
      id: 't',
      question: { text: 'Conte', topicId: s.plan!.topics[0].id },
      answer: { kind: 'specific', text: 'Atendi clientes' },
      factIds: [],
    },
  ];
  render(<Harness initialSession={s} />);
  expect(screen.getByText('Analisar este bloco')).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('checkbox'));
  (hasInterviewAccess as jest.Mock).mockReturnValue(true);
  // Access may become available after a verified request in the same page.
  fireEvent.change(screen.getByLabelText('Sua resposta'), { target: { value: 'Outra atividade' } });
  (analyzeInterviewBlock as jest.Mock).mockRejectedValueOnce(
    new AnalysisFailure('Limite atingido'),
  );
  fireEvent.click(screen.getByText('Analisar este bloco'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Limite atingido');
  expect((analyzeInterviewBlock as jest.Mock).mock.calls[0][0].context.facts).toHaveLength(1);
});
it('lets the person cancel corrections, reopen a pending question and edit a previously ready set', async () => {
  let s = requestReview(prepare({ ...initial(), phase: 'preparation' }, extraction, analysis));
  s.pending.push({
    id: 'p',
    topicId: 'discovery',
    criterionId: null,
    factIds: [],
    reason: 'Esclarecer período',
    blocking: true,
  });
  const view = render(<Harness initialSession={s} />);
  fireEvent.click(screen.getByText('Editar este fato'));
  fireEvent.click(screen.getByText('Cancelar correção'));
  expect(screen.queryByLabelText('Corrigir fato')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Esclarecer este ponto'));
  await screen.findByLabelText('Sua resposta');
  expect(screen.getByText(/Você contou versões diferentes/)).toBeInTheDocument();
  view.unmount();
  s = requestReview(prepare({ ...initial(), phase: 'preparation' }, extraction, analysis));
  s.facts[0].confirmation = 'confirmed';
  s.confirmation = {
    id: 'c',
    version: 1,
    inputs: s.inputs,
    dependencies: ['facts'],
    valid: true,
    factIds: ['f'],
  };
  s.phase = 'ready';
  render(<Harness initialSession={s} />);
  fireEvent.click(screen.getByText('Editar este fato'));
  fireEvent.change(screen.getByLabelText('Corrigir fato'), {
    target: { value: 'Corrigido depois da confirmação' },
  });
  fireEvent.click(screen.getByText('Salvar correção'));
  await waitFor(() => expect(state().facts[0].confirmation).toBe('candidate'));
  expect(state().confirmation!.valid).toBe(false);
});
it('does not apply late extraction or persistence responses after unmount', async () => {
  const s = initial();
  s.turns = [
    {
      id: 't',
      question: { text: 'Conte', topicId: 'discovery' },
      answer: { kind: 'specific', text: 'Atendi clientes' },
      factIds: [],
    },
  ];
  let resolve!: (v: unknown) => void;
  (analyzeInterviewBlock as jest.Mock).mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const view = render(<Harness initialSession={s} />);
  fireEvent.click(screen.getByText('Analisar este bloco'));
  await waitFor(() => expect(resolve).toBeDefined());
  view.unmount();
  await act(async () => resolve({}));
  expect(commitInterview).not.toHaveBeenCalled();
  let reject!: (v: unknown) => void;
  (commitInterview as jest.Mock).mockReturnValueOnce(
    new Promise((_r, j) => {
      reject = j;
    }),
  );
  const next = render(<Harness />);
  fireEvent.click(screen.getByText('Pausar conversa'));
  next.unmount();
  await act(async () => reject(new Error('late')));
});
it('does not count hidden or paused time, and resets the interval origin when visibility changes', async () => {
  jest.useFakeTimers();
  const visible = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const view = render(<Harness />);
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  expect(state().interview!.activeMs).toBe(0);
  visible.mockReturnValue('visible');
  fireEvent(document, new Event('visibilitychange'));
  fireEvent.click(screen.getByText('Pausar conversa'));
  await act(async () => {});
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  expect(state().interview!.activeMs).toBe(0);
  view.unmount();
  visible.mockRestore();
  jest.useRealTimers();
});
it.each([false, true])(
  'corrects an experience period and invalidates its confirmed facts (ready=%s)',
  async (ready) => {
    const s = requestReview(
      prepare(
        { ...initial(), phase: 'preparation' },
        structuredClone(extraction),
        structuredClone(analysis),
      ),
    );
    s.facts[0].confirmation = 'confirmed';
    if (ready) {
      s.confirmation = {
        id: 'confirmed',
        version: 1,
        inputs: s.inputs,
        dependencies: ['facts'],
        valid: true,
        factIds: ['f'],
      };
      s.phase = 'ready';
    }
    render(<Harness initialSession={s} />);
    fireEvent.click(screen.getByText('Corrigir atividade ou período'));
    fireEvent.click(screen.getByText('Cancelar edição da experiência'));
    fireEvent.click(screen.getByText('Corrigir atividade ou período'));
    fireEvent.change(screen.getByLabelText('Atividade e lugar'), {
      target: { value: 'Atividade informal na feira' },
    });
    fireEvent.change(screen.getByLabelText('Início (se lembrar)'), {
      target: { value: ready ? '' : '2021' },
    });
    fireEvent.change(screen.getByLabelText('Fim (se houver)'), {
      target: { value: ready ? '' : '2022' },
    });
    fireEvent.click(screen.getByText('Salvar experiência'));
    await waitFor(() => expect(state().experiences[0].title).toBe('Atividade informal na feira'));
    expect(state().facts[0].confirmation).toBe('candidate');
    expect(screen.queryByLabelText('Atividade e lugar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Conversar sobre esta experiência'));
    await screen.findByLabelText('Sua resposta');
  },
);
it('keeps a failed experience correction editable and reopens discovery when adding another experience', async () => {
  const s = requestReview(
    prepare(
      { ...initial(), phase: 'preparation' },
      structuredClone(extraction),
      structuredClone(analysis),
    ),
  );
  s.experiences[0].start = null;
  s.experiences[0].end = null;
  render(<Harness initialSession={s} />);
  fireEvent.click(screen.getByText('Corrigir atividade ou período'));
  (commitInterview as jest.Mock).mockRejectedValueOnce(new Error('quota'));
  fireEvent.click(screen.getByText('Salvar experiência'));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Atividade e lugar')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Cancelar edição da experiência'));
  fireEvent.click(screen.getByText('Incluir outra experiência, formação, curso ou idioma'));
  await screen.findByLabelText('Sua resposta');
  fireEvent.click(screen.getByText('Encerrar conversa e revisar'));
  await screen.findByText('O que você quer manter?');
  state().facts[0].confirmation = 'confirmed';
});
it('does not emit analytics when consolidated persistence fails', async () => {
  const s = requestReview(
    prepare(
      { ...initial(), phase: 'preparation' },
      structuredClone(extraction),
      structuredClone(analysis),
    ),
  );
  s.facts[0].confirmation = 'confirmed';
  render(<Harness initialSession={s} />);
  (commitInterview as jest.Mock).mockRejectedValueOnce(
    new AnalysisFailure('Não foi possível confirmar'),
  );
  fireEvent.click(screen.getByText('Confirmar os fatos que quero manter'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar');
  expect(captureAnalyticsEvent).not.toHaveBeenCalled();
});
it('renews explicit provider access and sends vacancy context without changing user confirmation', async () => {
  (hasInterviewAccess as jest.Mock).mockReturnValue(false);
  const s = initial();
  s.turns = [
    {
      id: 't',
      question: { text: 'Conte', topicId: 'discovery' },
      answer: { text: 'Atendi clientes', kind: 'specific' },
      factIds: [],
    },
  ];
  (analyzeInterviewBlock as jest.Mock).mockRejectedValueOnce(
    new AnalysisFailure('Capacidade indisponível'),
  );
  render(
    <InterviewWorkspace
      session={s}
      draft={{ hasJob: true, jobText: 'Atendimento ao público', targetRole: '', accepted: false }}
      onChange={jest.fn()}
    />,
  );
  fireEvent.click(screen.getByText('Verificação'));
  expect(screen.getByText('Analisar este bloco')).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('Analisar este bloco'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Capacidade indisponível');
  expect(analyzeInterviewBlock).toHaveBeenCalledWith(
    expect.objectContaining({ jobText: 'Atendimento ao público' }),
    expect.objectContaining({ accepted: true }),
    expect.objectContaining({ token: 'verified' }),
  );
  (hasInterviewAccess as jest.Mock).mockReturnValue(true);
});
it('does not revive the view when a save succeeds after navigation', async () => {
  let resolve!: (s: Session) => void;
  (commitInterview as jest.Mock).mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const view = render(<Harness />);
  fireEvent.click(screen.getByText('Pausar conversa'));
  view.unmount();
  await act(async () => resolve(initial()));
});
it('ignores a provider failure after unmount and a save completed after leaving the block', async () => {
  const s = initial();
  s.turns = [
    {
      id: 't',
      question: { text: 'Conte', topicId: 'discovery' },
      answer: { text: 'Atendi clientes', kind: 'specific' },
      factIds: [],
    },
  ];
  let reject!: (e: Error) => void;
  (analyzeInterviewBlock as jest.Mock).mockReturnValueOnce(
    new Promise((_r, j) => {
      reject = j;
    }),
  );
  const view = render(<Harness initialSession={s} />);
  fireEvent.click(screen.getByText('Analisar este bloco'));
  await waitFor(() => expect(reject).toBeDefined());
  view.unmount();
  await act(async () => reject(new Error('late')));
  (analyzeInterviewBlock as jest.Mock).mockResolvedValueOnce({
    version: 1,
    revision: s.revision,
    extraction: { experiences: [], facts: [] },
    analysis: null,
    assessments: [],
  });
  let resolve!: (value: Session) => void;
  (commitInterview as jest.Mock).mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const next = render(<Harness initialSession={s} />);
  fireEvent.click(screen.getByText('Analisar este bloco'));
  await waitFor(() => expect(resolve).toBeDefined());
  next.unmount();
  await act(async () => resolve(s));
});
it('blocks consolidation when links are contradictory even if a fact was previously confirmed', () => {
  const s = requestReview(
    prepare(
      { ...initial(), phase: 'preparation' },
      structuredClone(extraction),
      structuredClone(analysis),
    ),
  );
  s.facts[0].confirmation = 'confirmed';
  s.links[0].status = 'contradiction';
  s.links[0].declarationTurnId = 't';
  render(<Harness initialSession={s} />);
  expect(screen.getByText('Confirmar os fatos que quero manter')).toBeDisabled();
});
it('serializes simultaneous local commands instead of saving two stale revisions', async () => {
  let resolve!: (s: Session) => void;
  (commitInterview as jest.Mock).mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  render(<Harness />);
  const pause = screen.getByText('Pausar conversa');
  const review = screen.getByText('Encerrar conversa e revisar');
  act(() => {
    pause.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    review.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(commitInterview).toHaveBeenCalledTimes(1);
  await act(async () => resolve(initial()));
});
it('serializes simultaneous block requests before awaiting request hashing', async () => {
  const s = initial();
  s.turns = [
    {
      id: 't',
      question: { text: 'Conte', topicId: 'discovery' },
      answer: { kind: 'specific', text: 'Atendi clientes' },
      factIds: [],
    },
  ];
  (analyzeInterviewBlock as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  render(<Harness initialSession={s} />);
  const analyze = screen.getByText('Analisar este bloco');
  act(() => {
    analyze.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    analyze.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await screen.findByRole('alert');
  expect(analyzeInterviewBlock).toHaveBeenCalledTimes(1);
});
it('refuses to submit an answer before preparation has supplied an interview action', async () => {
  const s = initial();
  s.phase = 'preparation';
  render(<Harness initialSession={s} />);
  fireEvent.change(screen.getByLabelText('Sua resposta'), { target: { value: 'Relato' } });
  fireEvent.click(screen.getByText('Enviar resposta'));
  await act(async () => {});
  expect(commitInterview).not.toHaveBeenCalled();
});
it('keeps fact edits pending if the revision cannot be saved', async () => {
  const s = requestReview(
    prepare(
      { ...initial(), phase: 'preparation' },
      structuredClone(extraction),
      structuredClone(analysis),
    ),
  );
  render(<Harness initialSession={s} />);
  fireEvent.click(screen.getByText('Editar este fato'));
  (commitInterview as jest.Mock).mockRejectedValueOnce(new Error('stale'));
  fireEvent.click(screen.getByText('Salvar correção'));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Corrigir fato')).toBeInTheDocument();
});
it.each([false, true])(
  'requires resolving blocking pendencies before confirming a selected set (blocking=%s)',
  async (blocking) => {
    const s = requestReview(
      prepare(
        { ...initial(), phase: 'preparation' },
        structuredClone(extraction),
        structuredClone(analysis),
      ),
    );
    s.facts[0].confirmation = 'confirmed';
    s.pending = [
      { id: 'gap', criterionId: null, factIds: [], reason: 'Período não informado', blocking },
    ];
    render(<Harness initialSession={s} />);
    const button = screen.getByText('Confirmar os fatos que quero manter');
    if (blocking) expect(button).toBeDisabled();
    else {
      fireEvent.click(button);
      await screen.findByText('Fatos confirmados para preparar seu currículo');
    }
  },
);
it('turns internal diagnostic pendencies into a simple invitation instead of exposing a report', () => {
  const s = requestReview(initial());
  s.pending = [
    {
      id: 'internal',
      diagnosticFindingId: 'finding',
      criterionId: null,
      factIds: [],
      reason: 'INTERNAL_DIAGNOSTIC_REPORT',
      blocking: false,
    },
  ];
  render(<Harness initialSession={s} />);
  expect(screen.getByText('Há um detalhe da sua experiência para conferir.')).toBeInTheDocument();
  expect(screen.queryByText('INTERNAL_DIAGNOSTIC_REPORT')).not.toBeInTheDocument();
});
