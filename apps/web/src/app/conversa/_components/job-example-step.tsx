'use client';

import { useEffect, useState } from 'react';
import {
  archetypes,
  GUEST_ID_KEY,
  objectives,
  tones,
  type Archetype,
  type JobAnalysisResult,
  type JobDraft,
  type JobPreferences,
  type Objective,
  type Tone,
} from '../_lib/job-analysis';
import type { StoredResume } from '../_lib/resume-storage';

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

function visitorId() {
  const current = localStorage.getItem(GUEST_ID_KEY);
  if (current) return current;
  const next = crypto.randomUUID();
  localStorage.setItem(GUEST_ID_KEY, next);
  return next;
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
  onComplete: (result: JobAnalysisResult) => void;
}) {
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const hasRequiredInput = draft.hasJob
    ? Boolean(draft.jobText.trim())
    : Boolean(draft.targetRole.trim());
  const analysisDisabled = loading || !draft.accepted || !hasRequiredInput;
  const analysisDisabledMessage =
    !hasRequiredInput && !draft.accepted
      ? 'Informe os requisitos da vaga e aceite os Termos e a Política de Privacidade para analisar.'
      : !hasRequiredInput
        ? 'Informe os requisitos da vaga para analisar.'
        : !draft.accepted
          ? 'Aceite os Termos e a Política de Privacidade para analisar.'
          : undefined;
  const updateDraft = (next: Partial<JobDraft>) => onDraftChange({ ...draft, ...next });

  const analyze = async () => {
    setLoading(true);
    setNotice('');
    try {
      const root = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const access = await fetch(`${root}/guest/access`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          visitorId: visitorId(),
          acceptedTerms: true,
          acceptedPrivacy: true,
        }),
      });
      if (!access.ok) throw new Error('Não foi possível iniciar sua jornada.');
      const token = ((await access.json()) as { accessToken: string }).accessToken;
      const response = await fetch(`${root}/guest/job-analysis`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          documents: documents.map(({ id, text }) => ({ id, text })),
          ...(draft.hasJob ? { jobText: draft.jobText } : { targetRole: draft.targetRole }),
        }),
      });
      if (!response.ok) {
        const failure = (await response.json().catch(() => undefined)) as
          { code?: unknown; message?: unknown } | undefined;
        const failureCode = typeof failure?.code === 'string' ? failure.code : undefined;
        const providerLimitMessage =
          typeof failure?.message === 'string' && failureCode === 'AI_CAPACITY_EXHAUSTED'
            ? failure.message
            : undefined;
        const guestLimitMessage =
          failureCode === 'GUEST_ANALYSIS_LIMIT_REACHED' && typeof failure?.message === 'string'
            ? failure.message
            : undefined;
        throw new Error(
          response.status === 400
            ? (guestLimitMessage ?? 'Sua análise gratuita volta em até 24 horas.')
            : response.status === 503
              ? (providerLimitMessage ?? 'A análise está temporariamente indisponível.')
              : 'A análise está indisponível. Tente novamente.',
        );
      }
      onComplete((await response.json()) as JobAnalysisResult);
    } catch (caught) {
      setNotice(
        caught instanceof Error &&
          (caught.message.includes('24 horas') ||
            caught.message.includes('capacidade gratuita da IA') ||
            caught.message.includes('temporariamente indisponível'))
          ? caught.message
          : 'Verifique sua conexão e tente novamente em alguns instantes.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="job-example-step">
      <p className="section-kicker">Etapa 2 · definir o próximo passo</p>
      <h1>Qual vaga você quer buscar?</h1>
      <p>Cole os requisitos e a gente sugere como apresentar sua experiência.</p>
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
        <textarea
          aria-label="Requisitos da vaga"
          onChange={(event) => updateDraft({ jobText: event.target.value })}
          placeholder="Cole aqui a descrição ou os requisitos da vaga"
          rows={9}
          value={draft.jobText}
        />
      ) : (
        <input
          aria-label="Cargo que procura"
          onChange={(event) => updateDraft({ targetRole: event.target.value })}
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
        onClick={() => void analyze()}
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
            <span>
              {item.label}
              {item.value === suggested ? <small>Recomendado</small> : null}
            </span>
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
