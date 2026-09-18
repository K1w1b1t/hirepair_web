'use client';

import { useState } from 'react';
import type { StoredResume } from '../_lib/resume-storage';
import { ImportPanel } from './import-panel';
import { WizardShell } from './wizard-shell';

function MaterialsSummary({ documentCount }: { readonly documentCount: number }) {
  const hasDocuments = documentCount > 0;

  return (
    <section aria-live="polite" className="wizard-journey-summary">
      <div aria-hidden="true" className="wizard-materials-mark">
        <span />
        <span />
        <span />
      </div>
      <p className="section-kicker">Sua base para os próximos passos</p>
      <h2 className="font-[family-name:var(--font-heading)] text-2xl font-medium text-[var(--color-navy)]">
        {hasDocuments ? 'Tudo pronto para análise' : 'Tudo o que você trouxer conta'}
      </h2>
      <p className="text-sm leading-6 text-[var(--color-text-muted)]">
        {hasDocuments ? (
          <>
            Vamos considerar juntos {documentCount} {documentCount === 1 ? 'material' : 'materiais'}
            . Nenhum deles é tratado como principal.
          </>
        ) : (
          'Adicione um ou mais currículos. Vamos reunir todas as informações para preparar a próxima etapa da sua jornada.'
        )}
      </p>
      <div className="wizard-analysis-note">
        <span aria-hidden="true">✓</span>
        <p>Os arquivos ficam neste dispositivo enquanto você prepara esta etapa.</p>
      </div>
    </section>
  );
}

export function ConversationPageClient() {
  const [documents, setDocuments] = useState<StoredResume[]>([]);
  const preview = <MaterialsSummary documentCount={documents.length} />;

  return (
    <WizardShell
      currentStep={1}
      preview={preview}
      previewLabel="Resumo dos materiais"
      previewTitle="Materiais para análise"
      previewTriggerLabel="Ver resumo"
      totalSteps={5}
    >
      <ImportPanel onDocumentsChange={setDocuments} />
    </WizardShell>
  );
}
