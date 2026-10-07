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
  const hasRequiredInput = draft.hasJob
    ? Boolean(draft.jobText.trim())
    : Boolean(draft.targetRole.trim());
  const analysisDisabled = !challenge || loading || voiceBusy || !draft.accepted || !hasRequiredInput;
  const analysisDisabledMessage =
    !hasRequiredInput && !draft.accepted
      ? 'Informe os requisitos da vaga e aceite os Termos e a Política de Privacidade para analisar.'
      : !hasRequiredInput
        ? 'Informe os requisitos da vaga para analisar.'
        : !draft.accepted
          ? 'Aceite os Termos e a Política de Privacidade para analisar.'
          : undefined;
  const updateDraft = (next: Partial<JobDraft>) => onDraftChange({ ...draft, ...next });

  const analyze = async (verifiedChallenge: GuestChallenge) => {
    setLoading(true);
    setNotice('');
    try {
      const result = await analyzeGuest(documents, draft, verifiedChallenge);
      onComplete(result, await inputFingerprint(documents, draft));
    } catch (caught) {
      setNotice(
        caught instanceof AnalysisFailure
          ? caught.message
          : 'Verifique sua conexão e tente novamente em alguns instantes.',
      );
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
      <TurnstileChallenge key={challengeKey} onReady={onChallenge} />
      <div aria-label="Forma de definir o objetivo" className="job-toggle">
        <button
          aria-pressed={draft.hasJob}
          onClick={() => updateDraft({ hasJob: true })}
          type="button"
        >
          Tenho uma vaga
        </button>
        <button
          aria-pressed={!draft.hasJob}
          onClick={() => updateDraft({ hasJob: false })}
          type="button"
        >
          Ainda não tenho
        </button>
      </div>
      {draft.hasJob ? (
        <VoiceTextField
          key="job"
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
      ) : (
        <VoiceTextField
          key="role"
          className="job-text-input"
          disabled={loading}
          id="target-role"
          kind="input"
          label="Cargo que procura"
          onBusyChange={setVoiceBusy}
          onChange={(value) => updateDraft({ targetRole: value })}
          placeholder="Qual cargo você quer buscar?"
          value={draft.targetRole}
        />
      )}
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
      <button
        className="button button-primary"
        disabled={analysisDisabled}
        onClick={challenge ? () => void analyze(challenge) : undefined}
        title={analysisDisabledMessage}
        type="button"
      >
        {loading ? 'Analisando seu histórico…' : 'Analisar e sugerir'}
      </button>
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
}: {
  title: string;
  values: Array<{ value: T; label: string }>;
  value: T;
  suggested: T;
  onChange: (value: T) => void;
}) {
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
}: {
  result: JobAnalysisResult;
  preferences: JobPreferences;
  onPreferencesChange: (preferences: JobPreferences) => void;
  onEditJob: () => void;
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
          suggested={result.suggestedObjective}
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
        <button
          className="button button-primary"
          disabled
          title="A próxima etapa ainda está em construção."
          type="button"
        >
          Continuar · em breve
        </button>
      </div>
    </section>
  );
}
