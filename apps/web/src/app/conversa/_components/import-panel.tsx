'use client';

import { useState } from 'react';
import { diagnoseResumeText, type DiagnosticFinding } from '../_lib/diagnostic';
import {
  extractTextFromFile,
  extractedTextFromPaste,
  type ExtractedText,
} from '../_lib/extract-text';
import { DiagnosticFindings } from './diagnostic-findings';
import { ExtractedTextView } from './extracted-text-view';
import { FileDropzone } from './file-dropzone';

export interface ImportPanelProps {
  onDocumentChange?: (document: ExtractedText | null) => void;
}

type PanelView = 'findings' | 'text';

export function ImportPanel({ onDocumentChange }: ImportPanelProps) {
  const [document, setDocument] = useState<ExtractedText | null>(null);
  const [findings, setFindings] = useState<DiagnosticFinding[]>([]);
  const [view, setView] = useState<PanelView>('findings');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setExtractedDocument = (nextDocument: ExtractedText) => {
    setDocument(nextDocument);
    setFindings(diagnoseResumeText(nextDocument.text));
    setView('findings');
    setIsConfirmed(false);
    setError(null);
    onDocumentChange?.(nextDocument);
  };

  const handleFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setIsConfirmed(false);
    try {
      setExtractedDocument(await extractTextFromFile(file));
    } catch (caught) {
      setDocument(null);
      setFindings([]);
      setError(caught instanceof Error ? caught.message : 'Não foi possível ler esse arquivo.');
      onDocumentChange?.(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaste = (value: string) => {
    if (!value.trim()) {
      setDocument(null);
      setFindings([]);
      setError(null);
      onDocumentChange?.(null);
      return;
    }
    try {
      setExtractedDocument(extractedTextFromPaste(value));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não encontramos texto nesse arquivo.');
    }
  };

  return (
    <div className="import-panel">
      <div>
        <p className="section-kicker">Etapa 1 · trazer o que você já tem</p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-medium leading-tight tracking-[-0.025em] text-[var(--color-navy)] sm:text-5xl">
          Vamos começar pelo seu currículo antigo.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-[var(--color-text-muted)]">
          A gente lê o documento como os sistemas de triagem leem e mostra o que merece atenção, sem
          julgamento.
        </p>
      </div>

      {!document && !isProcessing ? (
        <FileDropzone disabled={isProcessing} onFile={handleFile} />
      ) : null}

      <div className="import-paste-block">
        <label
          className="font-[family-name:var(--font-heading)] font-semibold text-[var(--color-navy)]"
          htmlFor="resume-paste"
        >
          Prefere colar o texto?
        </label>
        <textarea
          aria-label="Colar o texto do currículo"
          className="import-textarea"
          id="resume-paste"
          onChange={(event) => handlePaste(event.target.value)}
          placeholder="Cole aqui o conteúdo do currículo"
          rows={5}
        />
      </div>

      {isProcessing ? (
        <div aria-live="polite" className="import-processing" role="status">
          <span className="import-processing-dot" />
          Lendo seu currículo em ordem, como uma máquina faria...
        </div>
      ) : null}

      {error ? (
        <div aria-live="polite" className="import-error" role="alert">
          <strong>Não conseguimos ler esse documento.</strong>
          <span>{error}</span>
          <button
            className="button button-outline button-small mt-3"
            onClick={() => setError(null)}
            type="button"
          >
            Trocar de arquivo
          </button>
        </div>
      ) : null}

      {document && !isProcessing ? (
        <section aria-live="polite" className="import-result">
          <div className="import-document-heading">
            <div>
              <p className="text-sm text-[var(--color-text-dim)]">Documento analisado</p>
              <h2 className="mt-1 font-[family-name:var(--font-heading)] font-semibold text-[var(--color-navy)]">
                {document.fileName}
              </h2>
            </div>
            <span className="import-document-type">{document.fileType}</span>
          </div>
          <div className="import-tabs" role="tablist" aria-label="Resultado da leitura">
            <button
              aria-selected={view === 'findings'}
              className={view === 'findings' ? 'is-active' : ''}
              onClick={() => setView('findings')}
              role="tab"
              type="button"
            >
              Diagnóstico
            </button>
            <button
              aria-selected={view === 'text'}
              className={view === 'text' ? 'is-active' : ''}
              onClick={() => setView('text')}
              role="tab"
              type="button"
            >
              Texto como a máquina lê
            </button>
          </div>
          <p aria-live="polite" className="sr-only" role="status">
            {findings.length} {findings.length === 1 ? 'achado encontrado' : 'achados encontrados'}
          </p>
          {view === 'findings' ? (
            <DiagnosticFindings findings={findings} />
          ) : (
            <ExtractedTextView text={document.text} />
          )}
          <div className="import-actions">
            {isConfirmed ? (
              <p className="import-confirmed" role="status">
                Currículo confirmado. Vamos continuar a partir dele.
              </p>
            ) : (
              <button
                className="button button-primary"
                onClick={() => setIsConfirmed(true)}
                type="button"
              >
                Continuar com este currículo
              </button>
            )}
            <button
              className="button button-outline button-small"
              onClick={() => {
                setDocument(null);
                setFindings([]);
                setIsConfirmed(false);
                onDocumentChange?.(null);
              }}
              type="button"
            >
              Trocar de arquivo
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
