'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  nextAction,
  interviewState,
  answerInterview,
  addActiveTime,
  requestReview,
  reopenInterview,
  incorporateBlock,
  editFact,
  editExperience,
  decideFact,
  resolveFactConflict,
  confirm,
  transition,
  canWrite,
  interrupt,
  discovery,
  replan,
  type Session,
  type Turn,
  type InterviewBlockRequest,
} from '@hirepair/interview-engine';
import { captureAnalyticsEvent } from '../../../analytics/analytics';
import { commitInterview, hashValue } from '../_lib/interview-session';
import {
  analyzeInterviewBlock,
  finishInterviewRequest,
  hasInterviewAccess,
  AnalysisFailure,
  cancelPreparation,
  type GuestChallenge,
} from '../_lib/guest-api';
import { sanitizeMaterial } from '../_lib/sanitize-material';
import type { JobDraft } from '../_lib/job-analysis';
import { HeaderProfile } from './header-profile';
import { VoiceTextField } from './voice-text-field';
import { TurnstileChallenge } from './turnstile-challenge';

export function InterviewWorkspace({
  session,
  draft,
  onChange,
}: {
  session: Session;
  draft: JobDraft;
  onChange: (session: Session) => void;
}) {
  const [answer, setAnswer] = useState('');
  const [modality, setModality] = useState<'text' | 'dictation'>('text');
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [challenge, setChallenge] = useState<GuestChallenge>();
  const [accepted, setAccepted] = useState(draft.accepted);
  const [experienceEdit, setExperienceEdit] = useState<{
    id: string;
    title: string;
    start: string;
    end: string;
  } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  const live = useRef(true);
  const lock = useRef(false);
  const current = useRef(session);
  current.current = session;
  const changed = useRef(onChange);
  changed.current = onChange;
  const action = nextAction(session);
  const state = interviewState(session);
  const review =
    action.kind === 'review' || action.kind === 'confirm' || session.phase === 'confirmation';
  const ready = session.phase === 'ready' && canWrite(session);
  const paused = !!session.interruption;
  const pendingTurns = session.turns.filter(
    (t) =>
      !state.analyzedTurnIds.includes(t.id) &&
      ['specific', 'vague'].includes(t.answer.kind) &&
      t.answer.text,
  );
  const speak = 'question' in action ? action.question : '';
  useEffect(() => {
    title.current?.focus();
  }, [review, ready, speak, paused]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      cancelPreparation();
    };
  }, []);
  const run = useCallback(
    async (payload: unknown, command: (s: Session, hash: string) => Session) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError('');
      try {
        const next = await commitInterview(
          current.current,
          { payload, revision: current.current.revision },
          command,
        );
        if (live.current) {
          current.current = next;
          changed.current(next);
        }
        return next;
      } catch (caught) {
        if (live.current)
          setError(
            caught instanceof AnalysisFailure
              ? caught.message
              : 'Não foi possível salvar. Reabra a jornada para conferir a versão atual.',
          );
      } finally {
        lock.current = false;
        if (live.current) setBusy(false);
      }
    },
    [],
  );
  useEffect(() => {
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const delta = now - last;
      last = now;
      const s = current.current;
      if (
        document.visibilityState !== 'visible' ||
        lock.current ||
        s.phase !== 'interview' ||
        s.interruption ||
        interviewState(s).reviewRequested
      )
        return;
      void run({ elapsed: delta }, (value) => addActiveTime(value, delta));
    }, 5000);
    const visibility = () => {
      last = Date.now();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
    // run reads the current aggregate through refs; restarting the clock on each save loses elapsed time.
  }, [run]);
  async function submit(kind: Turn['answer']['kind'], text: string) {
    if (!('topic' in action) || !action.topic || !speak) return;
    const turn: Turn = {
      id: crypto.randomUUID(),
      recordedAt: Date.now(),
      modality,
      question: { text: speak, topicId: action.topic.id },
      answer: { text: sanitizeMaterial(text), kind },
      factIds: [],
    };
    const saved = await run(turn, (s) => answerInterview(s, turn));
    if (saved) {
      setAnswer('');
      setModality('text');
    }
  }
  async function analyze() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    const s = current.current;
    try {
      const turns = s.turns.filter(
        (t) =>
          !interviewState(s).analyzedTurnIds.includes(t.id) &&
          ['specific', 'vague'].includes(t.answer.kind) &&
          t.answer.text,
      );
      const ids = new Set(turns.map((t) => t.question.topicId));
      const topics = [...replan(s).topics, discovery]
        .filter((t) => ids.has(t.id))
        .map(
          ({
            id,
            criterionId,
            experienceId,
            missingEvidence,
            reason,
            impact,
            uncertainty,
            relevance,
          }) => ({
            id,
            criterionId,
            experienceId,
            missingEvidence,
            reason,
            impact,
            uncertainty,
            relevance,
          }),
        );
      const request: InterviewBlockRequest = {
        version: 1,
        sessionId: s.id,
        funnelSessionId: s.funnelSessionId,
        revision: s.revision,
        inputsHash: await hashValue(s.inputs),
        objective: s.objective!.value,
        jobText: sanitizeMaterial(draft.hasJob ? draft.jobText : ''),
        targetRole: sanitizeMaterial(draft.targetRole),
        turns: turns.map((t) => ({
          id: t.id,
          text: sanitizeMaterial(t.answer.text),
          topicId: t.question.topicId,
        })),
        context: {
          experiences: s.experiences.map(({ id, title, start, end, current, origin }) => ({
            id,
            title,
            start,
            end,
            current,
            origin,
          })),
          facts: s.facts
            .filter((f) => f.confirmation !== 'rejected')
            .map(({ id, experienceId, text, origin }) => ({ id, experienceId, text, origin })),
        },
        topics,
      };
      const result = await analyzeInterviewBlock(request, { ...draft, accepted }, challenge);
      if (!live.current) return;
      const next = await commitInterview(s, { request, result }, (value, factsHash) =>
        requestReview(
          incorporateBlock(
            value,
            result,
            turns.map((t) => t.id),
            factsHash,
          ),
        ),
      );
      finishInterviewRequest();
      if (live.current) {
        current.current = next;
        changed.current(next);
      }
    } catch (caught) {
      if (live.current)
        setError(
          caught instanceof AnalysisFailure
            ? caught.message
            : 'Não foi possível analisar este bloco. Seus relatos foram preservados. Você pode revisar o material parcial.',
        );
    } finally {
      lock.current = false;
      if (live.current) {
        setBusy(false);
        setChallenge(undefined);
      }
    }
  }
  async function decide(id: string, kind: 'keep' | 'remove' | 'edit') {
    const text = editText;
    const saved = await run({ id, kind, text }, (s, hash) => {
      let next = s;
      if (!['interview', 'confirmation'].includes(next.phase)) next = reopenInterview(next);
      if (kind === 'edit') next = resolveFactConflict(editFact(next, id, text, hash), id);
      else {
        next = decideFact(
          next,
          id,
          kind === 'keep' ? 'confirmed' : 'rejected',
          kind === 'keep',
          hash,
        );
        if (kind === 'remove') next = resolveFactConflict(next, id);
      }
      return requestReview(next);
    });
    if (saved) setEditing(null);
  }
  async function consolidate() {
    const selected = session.facts
      .filter((f) => f.confirmation === 'confirmed' && f.usable)
      .map((f) => f.id);
    const saved = await run({ confirm: selected, inputs: session.inputs }, (s) =>
      transition(confirm(requestReview(s), selected), 'ready'),
    );
    if (saved)
      captureAnalyticsEvent('facts_confirmed', { funnel_session_id: saved.funnelSessionId });
  }
  const facts = session.facts;
  return (
    <section className="interview-workspace" aria-busy={busy}>
      <p className="section-kicker">
        {ready
          ? 'Seu próximo passo'
          : review
            ? 'Revisar seus fatos'
            : 'Vamos conhecer sua história'}
      </p>
      <h1 ref={title} tabIndex={-1}>
        {ready
          ? 'Fatos confirmados para preparar seu currículo'
          : review
            ? 'O que você quer manter?'
            : paused
              ? 'Sua conversa está pausada'
              : 'Uma experiência de cada vez'}
      </h1>
      <p>
        Você pode contar do seu jeito. Áudio é opcional. O que você confirma é uma informação
        declarada por você.
      </p>
      {error && <p role="alert">{error}</p>}
      <p role="status" aria-live="polite">
        {busy
          ? 'Salvando seu progresso…'
          : `${session.turns.length} ${session.turns.length === 1 ? 'resposta salva' : 'respostas salvas'} neste aparelho.`}
      </p>
      {!ready && !review && !paused && (
        <>
          <div className="job-result-summary">
            <h2>{speak}</h2>
            <p>{action.reason}</p>
          </div>
          <label htmlFor="interview-answer">Sua resposta</label>
          <VoiceTextField
            id="interview-answer"
            label="Sua resposta"
            kind="textarea"
            className="interview-answer"
            value={answer}
            placeholder="Conte uma situação que você lembra…"
            rows={5}
            disabled={busy}
            onChange={setAnswer}
            onBusyChange={(value) => {
              setVoiceBusy(value);
              if (value) setModality('dictation');
            }}
          />
          <p>Depois de ditar, confira e corrija o texto antes de enviar.</p>
          <p>
            {answer.length} de {state.limits.answerChars} caracteres
          </p>
          <button
            className="button button-primary"
            disabled={
              busy || voiceBusy || !answer.trim() || answer.length > state.limits.answerChars
            }
            onClick={() => void submit('specific', answer)}
          >
            Enviar resposta
          </button>
          <div className="interview-actions">
            {(
              [
                ['skipped', 'Pular'],
                ['unknown', 'Não sei'],
                ['forgotten', 'Não lembro'],
                ['absence', 'Não tenho essa experiência'],
                ['declined', 'Prefiro não responder'],
              ] as const
            ).map(([kind, label]) => (
              <button
                className="button button-outline"
                disabled={busy || voiceBusy}
                key={kind}
                onClick={() => void submit(kind, label)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="button button-outline"
            disabled={busy || voiceBusy}
            onClick={() =>
              void run('pause', (s) => interrupt(s, 'paused', 'Você escolheu pausar.'))
            }
          >
            Pausar conversa
          </button>
        </>
      )}
      {paused && (
        <>
          <p>{session.interruption!.reason}</p>
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => void run('resume', (s) => reopenInterview(s))}
          >
            Retomar conversa
          </button>
        </>
      )}
      {!ready && pendingTurns.length > 0 && (
        <section className="job-result-summary" aria-label="Analisar relatos do bloco">
          <h2>Vamos revisar este bloco?</h2>
          <p>
            Você contou {pendingTurns.length} respostas ainda não analisadas. Vamos identificar os
            fatos e o que precisa de mais detalhes.
          </p>
          {!hasInterviewAccess() && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />{' '}
                Aceito enviar estes relatos à IA conforme os Termos e a Política de Privacidade.
              </label>
              <TurnstileChallenge onReady={setChallenge} />
            </>
          )}
          <button
            className="button button-primary"
            disabled={busy || voiceBusy || (!hasInterviewAccess() && (!accepted || !challenge))}
            onClick={() => void analyze()}
          >
            Analisar este bloco
          </button>
        </section>
      )}
      {!ready && !review && (
        <button
          className="button button-outline"
          disabled={busy || voiceBusy}
          onClick={() => void run('review', requestReview)}
        >
          Encerrar conversa e revisar
        </button>
      )}
      {(review || ready) && (
        <>
          <p>{action.reason}</p>
          <HeaderProfile />
          <button
            className="button button-outline"
            disabled={busy}
            onClick={() => void run('add-experience', (s) => reopenInterview(s, 'discovery'))}
          >
            Incluir outra experiência, formação, curso ou idioma
          </button>
          <p>
            Confira cada fato. Números, ferramentas e competências só serão mantidos se você
            confirmar a versão mostrada.
          </p>
          {!facts.length && (
            <p>
              Ainda não há fatos candidatos. Seus relatos podem ser analisados acima, ou você pode
              voltar à conversa.
            </p>
          )}
          {session.experiences.map((experience) => (
            <section className="job-result-summary" key={experience.id}>
              <h2>{experience.title}</h2>
              {experienceEdit?.id === experience.id ? (
                <div>
                  {(['title', 'start', 'end'] as const).map((key) => (
                    <label key={key} htmlFor={`experience-${key}`}>
                      {
                        {
                          title: 'Atividade e lugar',
                          start: 'Início (se lembrar)',
                          end: 'Fim (se houver)',
                        }[key]
                      }
                      <input
                        id={`experience-${key}`}
                        maxLength={key === 'title' ? 200 : 40}
                        value={experienceEdit[key]}
                        onChange={(e) =>
                          setExperienceEdit({ ...experienceEdit, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <button
                    disabled={busy || !experienceEdit.title.trim()}
                    onClick={() => {
                      const patch = experienceEdit;
                      void run({ experience: patch }, (s, hash) =>
                        requestReview(
                          editExperience(
                            s.phase === 'ready' ? reopenInterview(s) : s,
                            patch.id,
                            {
                              title: patch.title,
                              start: patch.start || null,
                              end: patch.end || null,
                            },
                            hash,
                          ),
                        ),
                      ).then((saved) => {
                        if (saved) setExperienceEdit(null);
                      });
                    }}
                  >
                    Salvar experiência
                  </button>
                  <button onClick={() => setExperienceEdit(null)}>
                    Cancelar edição da experiência
                  </button>
                </div>
              ) : (
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() =>
                    setExperienceEdit({
                      id: experience.id,
                      title: experience.title,
                      start: experience.start ?? '',
                      end: experience.end ?? '',
                    })
                  }
                >
                  Corrigir atividade ou período
                </button>
              )}
              <button
                className="button button-outline"
                disabled={busy}
                onClick={() =>
                  void run({ revisit: experience.id }, (s) =>
                    reopenInterview(
                      s,
                      replan(s).topics.find((t) => t.experienceId === experience.id)?.id,
                    ),
                  )
                }
              >
                Conversar sobre esta experiência
              </button>
              <p>
                {experience.start ?? 'Período não informado'}
                {experience.end ? ` até ${experience.end}` : ''}
              </p>
              <ul className="interview-facts">
                {facts
                  .filter((f) => f.experienceId === experience.id)
                  .map((fact) => (
                    <li key={fact.id}>
                      <p>{fact.text}</p>
                      <p>
                        {fact.confirmation === 'confirmed'
                          ? 'Você quer manter este fato.'
                          : fact.confirmation === 'rejected'
                            ? 'Este fato será removido.'
                            : 'Aguardando sua confirmação.'}{' '}
                        Versão {fact.revision}.
                      </p>
                      <details>
                        <summary>De onde veio</summary>
                        <p>{fact.origin.quote}</p>
                      </details>
                      {editing === fact.id ? (
                        <>
                          <label htmlFor="fact-edit">Corrigir fato</label>
                          <textarea
                            id="fact-edit"
                            maxLength={500}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                          />
                          <button
                            disabled={busy || !editText.trim()}
                            onClick={() => void decide(fact.id, 'edit')}
                          >
                            Salvar correção
                          </button>
                          <button onClick={() => setEditing(null)}>Cancelar correção</button>
                        </>
                      ) : (
                        <div className="interview-actions">
                          <button
                            className="button button-outline"
                            disabled={busy || !fact.usable}
                            onClick={() => void decide(fact.id, 'keep')}
                          >
                            Manter este fato
                          </button>
                          <button
                            className="button button-outline"
                            disabled={busy}
                            onClick={() => {
                              setEditing(fact.id);
                              setEditText(fact.text);
                            }}
                          >
                            Editar este fato
                          </button>
                          <button
                            className="button button-outline"
                            disabled={busy}
                            onClick={() => void decide(fact.id, 'remove')}
                          >
                            Remover este fato
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
              </ul>
            </section>
          ))}
          <section aria-label="Pendências e lacunas">
            <h2>O que ainda falta esclarecer</h2>
            {session.pending.length ? (
              <ul>
                {session.pending.map((p) => (
                  <li key={p.id}>
                    {p.diagnosticFindingId
                      ? 'Há um detalhe da sua experiência para conferir.'
                      : p.reason}
                    {p.blocking ? ' Este ponto impede a confirmação.' : ''}
                    <button
                      className="button button-outline"
                      disabled={busy}
                      onClick={() =>
                        void run({ reopen: p.id }, (s) => reopenInterview(s, p.topicId))
                      }
                    >
                      Esclarecer este ponto
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhuma pendência registrada. Você pode manter uma versão parcial e honesta.</p>
            )}
          </section>
          {!ready && (
            <button
              className="button button-primary"
              disabled={
                busy ||
                !facts.some((f) => f.usable && f.confirmation === 'confirmed') ||
                session.pending.some((p) => p.blocking) ||
                session.links.some((l) => l.status === 'contradiction')
              }
              onClick={() => void consolidate()}
            >
              Confirmar os fatos que quero manter
            </button>
          )}
          <button
            className="button button-outline"
            disabled={busy}
            onClick={() => void run('reopen', (s) => reopenInterview(s))}
          >
            Voltar à conversa
          </button>
          {ready && (
            <p>Seu conjunto está confirmado. A redação será disponibilizada na próxima etapa.</p>
          )}
        </>
      )}
    </section>
  );
}
