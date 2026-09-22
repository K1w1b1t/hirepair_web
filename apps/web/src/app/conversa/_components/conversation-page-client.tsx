'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ANALYSIS_KEY,
  type JobAnalysisResult,
  type JobDraft,
  type JobPreferences,
} from '../_lib/job-analysis';
import type { StoredResume } from '../_lib/resume-storage';
import { ImportPanel } from './import-panel';
import { JobExampleStep, JobRecommendationsStep } from './job-example-step';
import { WizardShell } from './wizard-shell';

type JourneyPhase = 'materials' | 'job' | 'recommendations';
const initialDraft: JobDraft = { hasJob: true, jobText: '', targetRole: '', accepted: false };

function JourneyCheck() {
  return (
    <span aria-hidden="true" className="wizard-journey-check">
      <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
        <path
          d="m5 12.5 4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.25"
        />
      </svg>
    </span>
  );
}

function MaterialsSummary({
  documentCount,
  onStart,
}: {
  documentCount: number;
  onStart: () => void;
}) {
  const hasDocuments = documentCount > 0;
  return (
    <section aria-live="polite" className="wizard-journey-summary">
      {hasDocuments ? <JourneyCheck /> : null}
      <p className="section-kicker">Sua base para os próximos passos</p>
      <h2 className="font-[family-name:var(--font-heading)] text-2xl font-medium text-[var(--color-navy)]">
        {hasDocuments ? 'Pronto para continuar' : 'Tudo o que você trouxer conta'}
      </h2>
      <p className="text-sm leading-6 text-[var(--color-text-muted)]">
        {hasDocuments
          ? 'Seus materiais estão prontos. Agora vamos entender qual vaga você quer buscar.'
          : 'Adicione um ou mais currículos. Vamos reunir as informações para preparar a próxima etapa.'}
      </p>
      {hasDocuments ? (
        <button
          className="button button-primary wizard-start-button"
          onClick={onStart}
          type="button"
        >
          Continuar
        </button>
      ) : null}
      <div className="wizard-analysis-note">
        <JourneyCheck />
        <p>Os arquivos ficam neste dispositivo enquanto você prepara esta etapa.</p>
      </div>
    </section>
  );
}

function JobContextPreview() {
  return (
    <section className="wizard-empty-preview">
      <span aria-hidden="true" className="wizard-paper-mark" />
      <h2 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-[var(--color-navy)]">
        Suas sugestões aparecerão aqui
      </h2>
      <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
        Depois da análise, você poderá revisar a estrutura, o objetivo e o tom do currículo.
      </p>
    </section>
  );
}

export function ConversationPageClient() {
  const [documents, setDocuments] = useState<StoredResume[]>([]);
  const [phase, setPhase] = useState<JourneyPhase>('materials');
  const [draft, setDraft] = useState<JobDraft>(initialDraft);
  const [result, setResult] = useState<JobAnalysisResult>();
  const [preferences, setPreferences] = useState<JobPreferences>();

  useEffect(() => {
    const saved = localStorage.getItem(ANALYSIS_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        result: JobAnalysisResult;
        archetype: JobPreferences['archetype'];
        objective: JobPreferences['objective'];
        tone: JobPreferences['tone'];
      };
      setResult(parsed.result);
      setPreferences({
        archetype: parsed.archetype,
        objective: parsed.objective,
        tone: parsed.tone,
      });
    } catch {
      localStorage.removeItem(ANALYSIS_KEY);
    }
  }, []);

  useEffect(() => {
    if (result && preferences)
      localStorage.setItem(ANALYSIS_KEY, JSON.stringify({ result, ...preferences }));
  }, [preferences, result]);

  const handleDocumentsChange = useCallback((updatedDocuments: StoredResume[]) => {
    setDocuments(updatedDocuments);
    if (updatedDocuments.length === 0) setPhase('materials');
  }, []);

  const handleComplete = (analysis: JobAnalysisResult) => {
    setResult(analysis);
    setPreferences({
      archetype: analysis.suggestedArchetype,
      objective: analysis.suggestedObjective,
      tone: analysis.suggestedTone,
    });
    setPhase('recommendations');
  };

  const preview =
    phase === 'materials' ? (
      <MaterialsSummary
        documentCount={documents.length}
        onStart={() => setPhase(result && preferences ? 'recommendations' : 'job')}
      />
    ) : phase === 'job' ? (
      <JobContextPreview />
    ) : null;
  const currentStep = phase === 'materials' ? 1 : phase === 'job' ? 2 : 3;
  const goBack =
    phase === 'job'
      ? () => setPhase('materials')
      : phase === 'recommendations'
        ? () => setPhase('job')
        : undefined;

  return (
    <WizardShell
      currentStep={currentStep}
      onBack={goBack}
      preview={preview}
      previewLabel={phase === 'materials' ? 'Resumo dos materiais' : 'Orientação da análise'}
      previewOnMobile={phase === 'materials'}
      previewTitle="Materiais para análise"
      previewTriggerLabel="Ver resumo"
      totalSteps={5}
    >
      {phase === 'materials' ? <ImportPanel onDocumentsChange={handleDocumentsChange} /> : null}
      {phase === 'job' ? (
        <JobExampleStep
          documents={documents}
          draft={draft}
          onDraftChange={setDraft}
          onComplete={handleComplete}
        />
      ) : null}
      {phase === 'recommendations' && result && preferences ? (
        <JobRecommendationsStep
          result={result}
          preferences={preferences}
          onPreferencesChange={setPreferences}
          onEditJob={() => setPhase('job')}
        />
      ) : null}
    </WizardShell>
  );
}
