'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  startGuided,
  guidedQuestion,
  guidedAnswer,
  completeGuided,
  INTERVIEW_PAYLOAD_LIMIT,
  type Session,
  type InterviewBlockResult,
} from '@hirepair/interview-engine';
import { commitInterview, hashValue } from '../_lib/interview-session';
import {
  analyzeInterviewBlock,
  hasInterviewAccess,
  finishInterviewRequest,
  cancelPreparation,
  AnalysisFailure,
  type GuestChallenge,
} from '../_lib/guest-api';
import {
  planInterviewBlock,
  pendingInterviewTurns,
  applyInterviewBlockPlan,
} from '../_lib/interview-blocks';
import { sanitizeMaterial } from '../_lib/sanitize-material';
import type { JobDraft } from '../_lib/job-analysis';
import { captureAnalyticsEvent } from '../../../analytics/analytics';
import { TurnstileChallenge } from './turnstile-challenge';
import { useGuidedVoice } from './use-guided-voice';
export function InterviewWorkspace({
  session,
  draft,
  onChange,
}: {
  session: Session;
  draft: JobDraft;
  onChange: (s: Session) => void;
}) {
  const normalized = useMemo(() => startGuided(session), [session]),
    g = normalized.guided!;
  const [text, setText] = useState(''),
    [mode, setMode] = useState<'voice' | 'text'>('voice'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [challenge, setChallenge] = useState<GuestChallenge>();
  const current = useRef(normalized);
  current.current = normalized;
  const changed = useRef(onChange);
  changed.current = onChange;
  const live = useRef(true),
    lock = useRef(false),
    ended = useRef(false);
  const savingTime = useRef<Promise<void> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const payloadLimit = useRef(INTERVIEW_PAYLOAD_LIMIT);
  const planned = useMemo(
    () => planInterviewBlock(normalized, draft, '0'.repeat(64), payloadLimit.current),
    [normalized, draft],
  );
  const question = guidedQuestion(normalized);
  const done = g.status === 'complete',
    partial = g.status === 'partial';
  useEffect(() => {
    heading.current!.focus({ preventScroll: true });
  }, [question?.text, done, partial]);
  const pending = pendingInterviewTurns(normalized);
  const repeated = pending.some(
    (t) => g.answered.filter((id) => id === t.question.topicId).length > 1,
  );
  const readyToAnalyze =
    pending.length >= 3 ||
    !question ||
    repeated ||
    planned.deferred ||
    planned.blocked ||
    pending.some((t) => t.answer.kind === 'absence');
  const process = useCallback(
    async (s: Session) => {
      const inputsHash = await hashValue(s.inputs);
      let plan = planInterviewBlock(s, draft, inputsHash, payloadLimit.current);
      if (!plan.request) {
        if (plan.blocked) throw new AnalysisFailure('AI_INPUT_TOO_LARGE');
        return s;
      }
      let result: InterviewBlockResult;
      let attempts = 0,
        accessChallenge = challenge;
      for (;;) {
        try {
          const auth = accessChallenge;
          accessChallenge = undefined;
          result = await analyzeInterviewBlock(plan.request!, draft, auth);
          break;
        } catch (caught) {
          if (
            !(caught instanceof AnalysisFailure) ||
            caught.code !== 'AI_INPUT_TOO_LARGE' ||
            attempts >= 2
          )
            throw caught;
          const request = plan.request!;
          const smallerLimit =
            JSON.stringify(request).length -
            Math.max(1, Math.ceil(request.turns.reduce((sum, t) => sum + t.text.length, 0) / 2));
          const smaller = planInterviewBlock(s, draft, inputsHash, smallerLimit);
          if (!smaller.request) throw caught;
          payloadLimit.current = smallerLimit;
          plan = smaller;
          attempts++;
        }
      }
      if (!live.current) throw new Error('REQUEST_CANCELLED');
      const next = await commitInterview(s, { request: plan.request, result }, (value, hash) =>
        applyInterviewBlockPlan(value, result, plan, hash),
      );
      finishInterviewRequest();
      setChallenge(undefined);
      return next;
    },
    [draft, challenge],
  );
  const publish = useCallback((s: Session) => {
    if (live.current) {
      current.current = s;
      changed.current(s);
    }
  }, []);
  const send = useCallback(
    async (answer: string) => {
      if (savingTime.current) await savingTime.current;
      if (!live.current) return;
      if (lock.current || !answer.trim()) return;
      const s = current.current,
        q = guidedQuestion(s);
      if (!q) return;
      lock.current = true;
      setBusy(true);
      setError('');
      try {
        const lower = answer.trim().toLocaleLowerCase('pt-BR');
        const kind =
          /^(?:(?:quero\s+)?(?:parar|encerrar)|prefiro n[aã]o responder|n[aã]o quero responder)[.!]?$/i.test(
            lower,
          )
            ? 'declined'
            : /^n[aã]o (?:sei|tenho ideia)[.!]?$/i.test(lower)
              ? 'unknown'
              : /^n[aã]o (?:lembro|recordo)[.!]?$/i.test(lower)
                ? 'forgotten'
                : /^n[aã]o (?:tenho|tive)(?: essa experi[eê]ncia)?[.!]?$/i.test(lower)
                  ? 'absence'
                  : 'specific';
        const next = await commitInterview(s, { answer, topic: q.topic.id }, (value) =>
          guidedAnswer(value, {
            id: crypto.randomUUID(),
            recordedAt: Date.now(),
            modality: mode === 'voice' ? 'dictation' : 'text',
            question: { text: q.text, topicId: q.topic.id },
            answer: { text: sanitizeMaterial(answer), kind },
            factIds: [],
          }),
        );
        publish(next);
        setText('');
      } catch {
        if (live.current) setError('Sua resposta não foi salva. Tente enviar novamente.');
      } finally {
        lock.current = false;
        if (live.current) setBusy(false);
      }
    },
    [mode, publish],
  );
  const voice = useGuidedVoice(
    !busy && !done && !partial ? (question?.text ?? '') : '',
    setText,
    (value) => void send(value),
  );
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (
      (typeof (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition !==
        'function' &&
        typeof (window as unknown as { webkitSpeechRecognition?: unknown })
          .webkitSpeechRecognition !== 'function') ||
      window.matchMedia?.('(min-width: 768px)').matches
    )
      setMode('text');
  }, []);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      cancelPreparation();
    };
  }, []);
  useEffect(() => {
    if (done || partial || lock.current || !readyToAnalyze || error) return;
    if (pending.length && !hasInterviewAccess() && !challenge) return;
    lock.current = true;
    setBusy(true);
    void (async () => {
      try {
        let next = await process(current.current);
        const shouldFinish = !guidedQuestion(next) && pendingInterviewTurns(next).length === 0;
        if (shouldFinish)
          next = await commitInterview(next, { complete: next.inputs }, completeGuided);
        publish(next);
        if (next.guided!.status === 'complete' && !ended.current) {
          ended.current = true;
          captureAnalyticsEvent('interview_completed', { funnel_session_id: next.funnelSessionId });
        }
      } catch (caught) {
        if (live.current) {
          setError(
            caught instanceof AnalysisFailure
              ? caught.message
              : 'Não conseguimos organizar este trecho agora. Suas respostas estão salvas.',
          );
          const partialSession = {
            ...current.current,
            guided: { ...current.current.guided!, status: 'partial' as const },
          };
          try {
            publish(await commitInterview(current.current, 'partial', () => partialSession));
          } catch {
            /* The original saved history remains authoritative. */
          }
        }
      } finally {
        lock.current = false;
        if (live.current) setBusy(false);
      }
    })();
  }, [
    readyToAnalyze,
    pending.length,
    normalized.revision,
    done,
    partial,
    challenge,
    error,
    publish,
    process,
  ]);
  useEffect(() => {
    const timer = setInterval(() => {
      const s = current.current;
      if (
        lock.current ||
        document.visibilityState !== 'visible' ||
        s.guided!.status !== 'interview'
      )
        return;
      lock.current = true;
      const pendingSave = commitInterview(s, 'active-time', (value) => ({
        ...value,
        guided: { ...value.guided!, activeMs: value.guided!.activeMs + 5000 },
      }))
        .then((next) => {
          lock.current = false;
          publish(next);
        })
        .catch(() => setError('Não foi possível salvar seu progresso.'))
        .finally(() => {
          lock.current = false;
          savingTime.current = null;
        });
      savingTime.current = pendingSave;
    }, 5000);
    return () => clearInterval(timer);
  }, [publish]);
  const stateText = busy
    ? 'Organizando sua resposta…'
    : voice.status === 'speaking'
      ? 'Falando a pergunta…'
      : voice.status === 'listening'
        ? 'Ouvindo você…'
        : voice.status === 'preview'
          ? 'Entendi. Enviando em 2 segundos…'
          : 'Pode responder do seu jeito.';
  const stage = done ? 3 : g.answered.length < 3 ? 1 : g.answered.length < 6 ? 2 : 3;
  return (
    <section className="guided-interview" aria-busy={busy}>
      <div className="guided-progress">
        <span>
          {done
            ? 'Concluído'
            : `${stage} de 3 · ${['Sua história', 'Exemplos para a vaga', 'Organização final'][stage - 1]}`}
        </span>
        <span>{g.answered.length} respostas recebidas</span>
        <div
          role="progressbar"
          aria-label="Progresso da entrevista"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={done ? 100 : Math.min(90, g.answered.length * 11)}
        >
          <i style={{ width: `${done ? 100 : Math.min(90, g.answered.length * 11)}%` }} />
        </div>
      </div>
      {done ? (
        <div className="guided-success">
          <span aria-hidden="true">✓</span>
          <h1 ref={heading} tabIndex={-1}>
            Entrevista concluída
          </h1>
          <p>Organizamos suas informações para preparar seu currículo.</p>
        </div>
      ) : partial ? (
        <div className="guided-success">
          <h1 ref={heading} tabIndex={-1}>
            Suas respostas estão salvas
          </h1>
          <p>Ainda precisamos organizar algumas informações antes de preparar seu currículo.</p>
          <p role="status">{error}</p>
        </div>
      ) : (
        <>
          <p className="guided-kicker">
            {g.answered.length === 0 ? 'Vamos começar' : 'Estamos conhecendo sua história'}
          </p>
          <h1 className="guided-question" ref={heading} tabIndex={-1}>
            {question?.text ?? 'Já temos suas respostas. Vamos organizar tudo.'}
          </h1>
          <p className="guided-remaining">
            Vamos da sua primeira experiência até a atual ou mais recente.
          </p>
          <p className="guided-status" role="status" aria-live="polite">
            {stateText}
          </p>
          {error && <p role="alert">{error}</p>}
          {voice.notice && <p role="status">{voice.notice}</p>}
          {readyToAnalyze && pending.length > 0 && !hasInterviewAccess() && (
            <TurnstileChallenge onReady={setChallenge} />
          )}
          {mode === 'text' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
            >
              <label htmlFor="guided-answer">Sua resposta</label>
              <textarea
                id="guided-answer"
                value={text}
                maxLength={10000}
                rows={3}
                onChange={(e) => {
                  setText(e.target.value);
                  voice.replaceDraft(e.target.value);
                }}
                disabled={busy}
                placeholder="Escreva como você contaria para alguém…"
              />
              <div className="guided-controls">
                <button
                  className="button button-primary"
                  disabled={busy || !text.trim()}
                  type="submit"
                >
                  Enviar resposta
                </button>
                <button
                  className="button button-outline"
                  type="button"
                  disabled={busy}
                  onClick={() => setMode('voice')}
                >
                  Falar
                </button>
              </div>
            </form>
          ) : (
            <div className="guided-voice">
              <p className="guided-transcript" aria-live="polite">
                {text}
              </p>
              <button
                className={`guided-microphone ${voice.status}`}
                disabled={busy || voice.status === 'speaking' || !question}
                onClick={voice.microphone}
                aria-label={
                  voice.status === 'listening'
                    ? 'Pausar microfone'
                    : voice.status === 'preview'
                      ? 'Continuar falando'
                      : 'Ouvir e responder'
                }
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="9"
                    y="2"
                    width="6"
                    height="13"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
                <span>
                  {voice.status === 'listening'
                    ? 'Estou ouvindo'
                    : voice.status === 'preview'
                      ? 'Continuar falando'
                      : 'Toque para responder'}
                </span>
              </button>
              <button
                className="guided-write"
                disabled={busy}
                onClick={() => {
                  voice.pause();
                  setMode('text');
                }}
              >
                Escrever
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
