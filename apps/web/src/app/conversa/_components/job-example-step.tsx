'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  archetypes,
  objectives,
  tones,
  type Archetype,
  type JobAnalysisResult,
  type JobDraft,
  type JobPreferences,
  type Objective,
  type Tone,
} from '../_lib/job-analysis';
import {
  analyzeGuest,
  inputFingerprint,
  AnalysisFailure,
  type GuestChallenge,
} from '../_lib/guest-api';
import { TurnstileChallenge } from './turnstile-challenge';
import type { StoredResume } from '../_lib/resume-storage';
import { VoiceTextField } from './voice-text-field';

function AnalysisErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);
  if (!message) return null;
  return (
    <div aria-live="assertive" className="import-toast" role="alert">
      <div>
        <strong>Não foi possível analisar a vaga.</strong>
        <p>{message}</p>
      </div>
      <button
        aria-label="Fechar aviso"
        className="import-toast-close"
        onClick={onDismiss}
        type="button"
      >
        ×
      </button>
    </div>
  );
}

export function JobExampleStep({
  documents,
  draft,
  onDraftChange,
  onComplete,
}: {
  documents: StoredResume[];
  draft: JobDraft;
  onDraftChange: (draft: JobDraft) => void;
  onComplete: (result: JobAnalysisResult, hash: string) => void;
}) {
  const [notice, setNotice] = useState('');
  const [challenge, setChallenge] = useState<GuestChallenge>();
  const [challengeKey, setChallengeKey] = useState(0);
  const onChallenge = useCallback((value?: GuestChallenge) => setChallenge(value), []);
  const [loading, setLoading] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const hasJob = Boolean(draft.jobText.trim());
  const unavailable = !draft.objective || !challenge || loading || voiceBusy || !draft.accepted;
  const guidance = !draft.accepted
    ? 'Aceite os Termos e a Política de Privacidade para continuar.'
    : !draft.objective
      ? 'Escolha seu objetivo para continuar.'
      : !challenge
        ? 'Aguarde a verificação para continuar.'
        : voiceBusy
          ? 'Conclua o ditado para continuar.'
          : '';
  const updateDraft = (next: Partial<JobDraft>) => onDraftChange({ ...draft, ...next });

  const analyze = async (verifiedChallenge: GuestChallenge, withJob: boolean) => {
    const submittedDraft = {
      ...draft,
      hasJob: withJob,
      jobText: withJob ? draft.jobText : '',
      targetRole: '',
    };
    onDraftChange(submittedDraft);
    setLoading(true);
    setNotice('');
    try {
      const result = await analyzeGuest(documents, submittedDraft, verifiedChallenge);
      onComplete(result, await inputFingerprint(documents, submittedDraft));
    } catch (caught) {
      let message = 'Verifique sua conexão e tente novamente em alguns instantes.';
      if (caught instanceof AnalysisFailure) message = caught.message;
      else if (
        caught instanceof Error &&
        ['LOCAL_STORAGE_UNAVAILABLE', 'REVISION_CONFLICT'].includes(caught.message)
      )
        message = new AnalysisFailure(caught.message).message;
      setNotice(message);
    } finally {
      setLoading(false);
      setChallenge(undefined);
      setChallengeKey((value) => value + 1);
    }
  };

  return (
    <section className="job-example-step">
      <p className="section-kicker">Etapa 2 · definir o próximo passo</p>
      <h1>Qual vaga você quer buscar?</h1>
      <p>Escreva, cole ou fale os requisitos e a gente sugere como apresentar sua experiência.</p>
      <p>
        Ao analisar, o texto profissional e a vaga são enviados ao Groq, após remoção de
        identificadores e contatos reconhecidos. Os originais continuam neste aparelho. Evite
        incluir dados pessoais desnecessários.
      </p>
      <fieldset className="job-choice" disabled={loading}>
        <legend>O que você quer neste momento?</legend>
        <p>
          Escolha o que mais importa agora. Se estiver em dúvida, pode escolher uma opção provisória
          e revisar depois.
        </p>
        <select
          aria-label="Seu objetivo pessoal"
          value={draft.objective ?? ''}
          onChange={(event) => updateDraft({ objective: event.target.value as Objective })}
        >
          <option value="" disabled>
            Escolha seu objetivo
          </option>
          {objectives.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <p>
          Entrar rápido prioriza renda agora; maximizar salário prioriza melhores ofertas; mudar de
          área valoriza experiências transferíveis; trabalhar remoto prioriza flexibilidade de
          local; conciliar rotina prioriza horários compatíveis.
        </p>
        <label>
          Esta escolha é provisória?{' '}
          <select
            aria-label="Objetivo provisório"
            value={draft.provisional ? 'yes' : 'no'}
            onChange={(event) => updateDraft({ provisional: event.target.value === 'yes' })}
          >
            <option value="no">Não, este é meu objetivo</option>
            <option value="yes">Sim, confirmo por enquanto</option>
          </select>
        </label>
      </fieldset>
      <TurnstileChallenge key={challengeKey} onReady={onChallenge} />
      <VoiceTextField
        className="job-text-input"
        disabled={loading}
        id="job-text"
        kind="textarea"
        label="Requisitos da vaga"
        onBusyChange={setVoiceBusy}
        onChange={(value) => updateDraft({ jobText: value })}
        placeholder="Escreva, cole ou fale os requisitos da vaga"
        rows={9}
        value={draft.jobText}
      />
      <div className="job-terms">
        <input
          aria-describedby="job-terms-description"
          checked={draft.accepted}
          id="job-terms-accepted"
          onChange={(event) => updateDraft({ accepted: event.target.checked })}
          type="checkbox"
        />
        <label htmlFor="job-terms-accepted">Li e aceito os </label>
        <a className="job-terms-link" href="/legal#terms">
          Termos
        </a>
        <span> e a </span>
        <a className="job-terms-link" href="/legal#privacy">
          Política de Privacidade
        </a>
        <span id="job-terms-description">. A análise usa IA para prestar este serviço.</span>
      </div>
      <p id="job-action-guidance" aria-live="polite">
        {guidance}
      </p>
      <div className="job-actions">
        <button
          aria-describedby="job-action-guidance"
          className="button button-primary"
          disabled={unavailable || !hasJob}
          onClick={challenge ? () => void analyze(challenge, true) : undefined}
          type="button"
        >
          Analisar
        </button>
        <button
          aria-describedby="job-action-guidance"
          className="button button-primary"
          disabled={unavailable || hasJob}
          onClick={challenge ? () => void analyze(challenge, false) : undefined}
          type="button"
        >
          Seguir sem vaga
        </button>
      </div>
      {loading ? <AnalysisTransition /> : null}
      <AnalysisErrorToast message={notice} onDismiss={() => setNotice('')} />
    </section>
  );
}

function AnalysisTransition() {
  return (
    <div
      aria-busy="true"
      aria-label="Preparando suas sugestões"
      aria-modal="true"
      className="job-analysis-transition"
      role="dialog"
    >
      <div className="job-analysis-transition-card">
        <span aria-hidden="true" className="job-analysis-spinner" data-testid="analysis-spinner" />
        <h2>Preparando suas sugestões</h2>
        <p>Isso pode levar alguns segundos.</p>
      </div>
    </div>
  );
}

function Choice<T extends string>({
  title,
  values,
  value,
  suggested,
  onChange,
}: Readonly<{
  title: string;
  values: Array<{ value: T; label: string }>;
  value: T;
  suggested?: T;
  onChange: (value: T) => void;
}>) {
  return (
    <fieldset className="job-choice">
      <legend>{title}</legend>
      <div>
        {values.map((item) => (
          <label key={item.value}>
            <input
              checked={value === item.value}
              name={title}
              onChange={() => onChange(item.value)}
              type="radio"
              value={item.value}
            />
            {item.value === suggested ? <small>Recomendado!</small> : null}
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function JobRecommendationsStep({
  result,
  preferences,
  onPreferencesChange,
  onEditJob,
  onContinue,
}: {
  result: JobAnalysisResult;
  preferences: JobPreferences;
  onPreferencesChange: (preferences: JobPreferences) => void;
  onEditJob: () => void;
  onContinue?: () => void;
}) {
  const update = (next: Partial<JobPreferences>) =>
    onPreferencesChange({ ...preferences, ...next });
  return (
    <section className="job-recommendations-step">
      <p className="section-kicker">Etapa 3 · revisar as recomendações</p>
      <h1>Sugerido para você</h1>
      <div className="job-result-summary">
        <span className="job-recommendation-badge">Recomendação personalizada</span>
        <h2>{result.targetRole}</h2>
        <p>{result.reason}</p>
        <p>{result.summary}</p>
        {result.requirements.length ? (
          <ul aria-label="Requisitos principais da vaga">
            {result.requirements.map((item) => (
              <li key={item.text}>{item.text}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="job-recommendation-choices">
        <Choice<Archetype>
          title="Estrutura do currículo"
          values={archetypes}
          value={preferences.archetype}
          suggested={result.suggestedArchetype}
          onChange={(archetype) => update({ archetype })}
        />
        <Choice<Objective>
          title="Seu objetivo"
          values={objectives}
          value={preferences.objective}
          onChange={(objective) => update({ objective })}
        />
        <Choice<Tone>
          title="Tom de escrita"
          values={tones}
          value={preferences.tone}
          suggested={result.suggestedTone}
          onChange={(tone) => update({ tone })}
        />
      </div>
      <div className="job-recommendation-actions">
        <button className="button button-outline" onClick={onEditJob} type="button">
          Editar vaga
        </button>
        <button className="button button-primary" onClick={onContinue} type="button">
          Começar entrevista
        </button>
      </div>
    </section>
  );
}
