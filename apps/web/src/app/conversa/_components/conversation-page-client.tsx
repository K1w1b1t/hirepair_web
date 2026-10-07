'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type JobAnalysisResult, type JobDraft, type JobPreferences } from '../_lib/job-analysis';
import { listStoredResumes, type StoredResume } from '../_lib/resume-storage';
import { ImportPanel } from './import-panel';
import { JobExampleStep, JobRecommendationsStep } from './job-example-step';
import { WizardShell } from './wizard-shell';

import { initialDraft, persistJourney, restoreJourney } from '../_lib/journey-storage';

type JourneyPhase = 'materials' | 'job' | 'recommendations';
const PHASE_QUERY_PARAM = 'etapa';

function phaseFromQuery(value: string | null): JourneyPhase {
  return value === 'job' || value === 'recommendations' ? value : 'materials';
}

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
        <p>
          Seus materiais ficam neste navegador até você limpar os dados dele. Ao analisar, uma cópia
          do texto com identificadores reconhecidos removidos é enviada à IA. Em aparelhos
          compartilhados, outras pessoas podem acessar os materiais locais.
        </p>
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
  const documentsRef = useRef<StoredResume[]>([]);
  const [phase, setPhase] = useState<JourneyPhase>('materials');
  const [draft, setDraft] = useState<JobDraft>(initialDraft);
  const [result, setResult] = useState<JobAnalysisResult>();
  const [preferences, setPreferences] = useState<JobPreferences>();
  const [inputHash, setInputHash] = useState<string>();
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);
  const hasUserNavigated = useRef(false);

  const transitionTo = useCallback((nextPhase: JourneyPhase) => {
    hasUserNavigated.current = true;
    setPhase(nextPhase);
    const url = new URL(window.location.href);
    url.searchParams.set(PHASE_QUERY_PARAM, nextPhase);
    window.history.replaceState(window.history.state, '', url);
  }, []);

  useEffect(() => {
    let mounted = true;
    const restoreConversation = async () => {
      const requestedPhase = phaseFromQuery(
        new URLSearchParams(window.location.search).get(PHASE_QUERY_PARAM),
      );
      const storedResumes = await listStoredResumes();
      if (!mounted) return;
      setDocuments(storedResumes);
      documentsRef.current = storedResumes;

      const saved = await restoreJourney(storedResumes);
      if (!mounted) return;
      setDraft(saved.draft);
      setResult(saved.result);
      setPreferences(saved.preferences);
      setInputHash(saved.inputHash);
      hydratedRef.current = true;
      setHydrated(true);
      const hasAnalysis = Boolean(saved.result);

      const restoredPhase =
        requestedPhase === 'recommendations' && !hasAnalysis
          ? storedResumes.length
            ? 'job'
            : 'materials'
          : requestedPhase === 'job' && storedResumes.length === 0
            ? 'materials'
            : requestedPhase;
      if (!hasUserNavigated.current) {
        setPhase(restoredPhase);
        const url = new URL(window.location.href);
        url.searchParams.set(PHASE_QUERY_PARAM, restoredPhase);
        window.history.replaceState(window.history.state, '', url);
      }
    };
    void restoreConversation();
    return () => {
      mounted = false;
    };
  }, [transitionTo]);

  useEffect(() => {
    if (hydrated) persistJourney({ draft, result, preferences, inputHash });
  }, [draft, hydrated, inputHash, preferences, result]);

  const invalidateAnalysis = useCallback(() => {
    setResult(undefined);
    setPreferences(undefined);
    setInputHash(undefined);
  }, []);
  const handleDocumentsChange = useCallback(
    (updatedDocuments: StoredResume[]) => {
      if (!hydratedRef.current) return;
      const current = documentsRef.current;
      if (
        JSON.stringify(current.map(({ id, text }) => ({ id, text }))) !==
        JSON.stringify(updatedDocuments.map(({ id, text }) => ({ id, text })))
      ) {
        invalidateAnalysis();
        documentsRef.current = updatedDocuments;
        setDocuments(updatedDocuments);
      }
      if (updatedDocuments.length === 0) transitionTo('materials');
    },
    [invalidateAnalysis, transitionTo],
  );
  const handleDraftChange = (next: JobDraft) => {
    if (
      next.hasJob !== draft.hasJob ||
      next.jobText !== draft.jobText ||
      next.targetRole !== draft.targetRole
    )
      invalidateAnalysis();
    setDraft(next);
  };
  const handleComplete = (analysis: JobAnalysisResult, hash: string) => {
    setResult(analysis);
    setInputHash(hash);
    setPreferences({
      archetype: analysis.suggestedArchetype,
      objective: analysis.suggestedObjective,
      tone: analysis.suggestedTone,
    });
    transitionTo('recommendations');
  };

  const preview =
    phase === 'materials' ? (
      <MaterialsSummary
        documentCount={documents.length}
        onStart={() => transitionTo(result && preferences ? 'recommendations' : 'job')}
      />
    ) : phase === 'job' ? (
      <JobContextPreview />
    ) : null;
  const currentStep = phase === 'materials' ? 1 : phase === 'job' ? 2 : 3;
  const goBack =
    phase === 'job'
      ? () => transitionTo('materials')
      : phase === 'recommendations'
        ? () => transitionTo('job')
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
          onDraftChange={handleDraftChange}
          onComplete={handleComplete}
        />
      ) : null}
      {phase === 'recommendations' && result && preferences ? (
        <JobRecommendationsStep
          result={result}
          preferences={preferences}
          onPreferencesChange={setPreferences}
          onEditJob={() => transitionTo('job')}
        />
      ) : null}
    </WizardShell>
  );
}
