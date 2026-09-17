'use client';

import { useState } from 'react';
import type { ExtractedText } from '../_lib/extract-text';
import { ImportPanel } from './import-panel';
import { WizardShell } from './wizard-shell';

function ResumePreview({ document }: { document: ExtractedText | null }) {
  if (!document) {
    return (
      <div className="wizard-empty-preview">
        <span aria-hidden="true" className="wizard-paper-mark" />
        <p className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-navy)]">
          Seu currículo começa aqui
        </p>
        <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--color-text-muted)]">
          Importe um currículo antigo ou cole o texto para ver como ele chega ao sistema de triagem.
        </p>
      </div>
    );
  }

  return (
    <div className="wizard-document-preview">
      <div className="wizard-document-preview-header">
        <span className="import-document-type">{document.fileType}</span>
        <span className="text-xs text-[var(--color-text-dim)]">Texto extraído</span>
      </div>
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-navy)]">
        {document.fileName}
      </h2>
      <pre className="wizard-document-preview-text">{document.text}</pre>
    </div>
  );
}

export function ConversationPageClient() {
  const [document, setDocument] = useState<ExtractedText | null>(null);
  const preview = <ResumePreview document={document} />;

  return (
    <WizardShell currentStep={1} preview={preview} totalSteps={5}>
      <ImportPanel onDocumentChange={setDocument} />
    </WizardShell>
  );
}
