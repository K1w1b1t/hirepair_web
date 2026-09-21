'use client';

import { useCallback, useState } from 'react';
import type { StoredResume } from '../_lib/resume-storage';
import { ImportPanel } from './import-panel';
import { JobExampleStep } from './job-example-step';
import { WizardShell } from './wizard-shell';

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
  hasStarted,
  onStart,
}: {
  readonly documentCount: number;
  readonly hasStarted: boolean;
  readonly onStart: () => void;
}) {
  const hasDocuments = documentCount > 0;

  return (
    <section aria-live="polite" className="wizard-journey-summary">
      {hasDocuments ? <JourneyCheck /> : null}
      <p className="section-kicker">Sua base para os próximos passos</p>
      <h2 className="font-[family-name:var(--font-heading)] text-2xl font-medium text-[var(--color-navy)]">
        {hasDocuments ? 'Iniciar' : 'Tudo o que você trouxer conta'}
      </h2>
      <p className="text-sm leading-6 text-[var(--color-text-muted)]">
        {hasDocuments
          ? 'Seus materiais estão prontos. No próximo passo, vamos transformar o que você trouxe em sua jornada profissional.'
          : 'Adicione um ou mais currículos. Vamos reunir todas as informações para preparar a próxima etapa da sua jornada.'}
      </p>
      {hasDocuments ? (
        hasStarted ? (
          <output className="wizard-started">Sua jornada está pronta para começar.</output>
        ) : (
          <button
            className="button button-primary wizard-start-button"
            onClick={onStart}
            type="button"
          >
            Iniciar
          </button>
        )
      ) : null}
      <div className="wizard-analysis-note">
        <JourneyCheck />
        <p>Os arquivos ficam neste dispositivo enquanto você prepara esta etapa.</p>
      </div>
    </section>
  );
}

export function ConversationPageClient() {
  const [documents, setDocuments] = useState<StoredResume[]>([]);
  const [hasStarted, setHasStarted] = useState(false);

  const handleDocumentsChange = useCallback((updatedDocuments: StoredResume[]) => {
    setDocuments(updatedDocuments);
    setHasStarted(false);
  }, []);

  const preview = (
    <MaterialsSummary
      documentCount={documents.length}
      hasStarted={hasStarted}
      onStart={() => setHasStarted(true)}
    />
  );

  return (
    <WizardShell
      currentStep={hasStarted ? 2 : 1}
      preview={preview}
      previewLabel="Resumo dos materiais"
      previewTitle="Materiais para análise"
      previewTriggerLabel="Ver resumo"
      totalSteps={5}
    >
      {hasStarted ? (
        <JobExampleStep documents={documents} />
      ) : (
        <ImportPanel onDocumentsChange={handleDocumentsChange} />
      )}
    </WizardShell>
  );
}
