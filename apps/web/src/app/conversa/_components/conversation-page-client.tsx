'use client';

import { useState } from 'react';
import type { ExtractedText } from '../_lib/extract-text';
import type { StoredResume } from '../_lib/resume-storage';
import { ImportPanel } from './import-panel';
import { WizardShell } from './wizard-shell';

function ResumePreview({
  document,
  documentCount,
}: {
  readonly document: ExtractedText | null;
  readonly documentCount: number;
}) {
  if (!document) {
    return (
      <div className="wizard-empty-preview">
        <span aria-hidden="true" className="wizard-paper-mark" />
        <p className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-navy)]">
          Seu currículo começa aqui
        </p>
        <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--color-text-muted)]">
          Importe um ou mais currículos para ver como chegam ao sistema de triagem.
        </p>
      </div>
    );
  }

  return (
    <div className="wizard-document-preview">
      <div className="wizard-document-preview-header">
        <span className="import-document-type">{document.fileType}</span>
        <span className="text-xs text-[var(--color-text-dim)]">
          {documentCount} {documentCount === 1 ? 'documento' : 'documentos'} locais
        </span>
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
  const [documents, setDocuments] = useState<StoredResume[]>([]);
  const preview = <ResumePreview document={document} documentCount={documents.length} />;

  return (
    <WizardShell currentStep={1} preview={preview} totalSteps={5}>
      <ImportPanel onDocumentChange={setDocument} onDocumentsChange={setDocuments} />
    </WizardShell>
  );
}
