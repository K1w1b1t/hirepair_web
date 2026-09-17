'use client';

import { useEffect, useRef, useState } from 'react';
import { diagnoseResumeText, sortDiagnosticFindings } from '../_lib/diagnostic';
import {
  extractTextFromFile,
  extractedTextFromPaste,
  type ExtractedText,
} from '../_lib/extract-text';
import {
  deleteStoredResume,
  listStoredResumes,
  saveStoredResume,
  toStoredResume,
  type StoredResume,
} from '../_lib/resume-storage';
import { DiagnosticFindings } from './diagnostic-findings';
import { ExtractedTextView } from './extracted-text-view';
import { FileDropzone } from './file-dropzone';

export interface ImportPanelProps {
  readonly onDocumentChange?: (document: ExtractedText | null) => void;
  readonly onDocumentsChange?: (documents: StoredResume[]) => void;
}

type PanelView = 'findings' | 'text';

function createPastedResume(value: string, documents: StoredResume[]): StoredResume {
  const document = extractedTextFromPaste(value);
  const findings = diagnoseResumeText(document.text);
  const previous = documents.find((item) => item.source === 'pasted');
  if (previous) return { ...previous, text: document.text, findings };
  return toStoredResume(document, findings);
}

export function ImportPanel({ onDocumentChange, onDocumentsChange }: ImportPanelProps) {
  const [documents, setDocuments] = useState<StoredResume[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<PanelView>('findings');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLocalChanges = useRef(false);

  useEffect(() => {
    let mounted = true;
    void listStoredResumes().then((storedResumes) => {
      if (!mounted) return;
      if (!hasLocalChanges.current) {
        setDocuments(storedResumes);
        setActiveId(storedResumes[0]?.id ?? null);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const activeDocument = documents.find((item) => item.id === activeId) ?? documents[0] ?? null;
  const allFindings = sortDiagnosticFindings(documents.flatMap((document) => document.findings));

  useEffect(() => {
    onDocumentsChange?.(documents);
    onDocumentChange?.(activeDocument);
  }, [activeDocument, documents, onDocumentChange, onDocumentsChange]);

  const addDocument = async (document: ExtractedText) => {
    hasLocalChanges.current = true;
    const storedDocument = toStoredResume(document, diagnoseResumeText(document.text));
    await saveStoredResume(storedDocument);
    setDocuments((current) => [...current, storedDocument]);
    setActiveId(storedDocument.id);
    setView('findings');
    setIsConfirmed(false);
  };

  const handleFiles = async (files: File[]) => {
    setIsProcessing(true);
    setError(null);
    const errors: string[] = [];
    for (const file of files) {
      try {
        await addDocument(await extractTextFromFile(file));
      } catch (error_) {
        errors.push(
          `${file.name}: ${error_ instanceof Error ? error_.message : 'não foi possível ler.'}`,
        );
      }
    }
    if (errors.length > 0) setError(errors.join(' '));
    setIsProcessing(false);
  };

  const handlePaste = (value: string) => {
    if (!value.trim()) return;
    try {
      hasLocalChanges.current = true;
      const storedDocument = createPastedResume(value, documents);
      void saveStoredResume(storedDocument);
      setDocuments((current) =>
        current.some((item) => item.id === storedDocument.id)
          ? current.map((item) => (item.id === storedDocument.id ? storedDocument : item))
          : [...current, storedDocument],
      );
      setActiveId(storedDocument.id);
      setView('findings');
      setIsConfirmed(false);
      setError(null);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Não encontramos texto nesse arquivo.');
    }
  };

  const removeActiveDocument = async () => {
    if (!activeDocument) return;
    await deleteStoredResume(activeDocument.id);
    const remaining = documents.filter((item) => item.id !== activeDocument.id);
    setDocuments(remaining);
    setActiveId(remaining[0]?.id ?? null);
    setIsConfirmed(false);
  };

  return (
    <div className="import-panel">
      <div>
        <p className="section-kicker">Etapa 1 · trazer o que você já tem</p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-medium leading-tight tracking-[-0.025em] text-[var(--color-navy)] sm:text-5xl">
          Vamos começar pela sua jornada profissional.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-[var(--color-text-muted)]">
          Você pode trazer um ou mais currículos. A gente lê tudo como os sistemas de triagem leem e
          mostra o que merece atenção, sem julgamento.
        </p>
      </div>

      {!isProcessing ? <FileDropzone disabled={false} onFiles={handleFiles} /> : null}

      <div aria-label="Jornada falada" className="import-voice-option">
        <button className="button button-outline import-voice-button" disabled type="button">
          <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
            <path
              d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 1 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
            <path
              d="M18.5 11.5a6.5 6.5 0 0 1-13 0M12 18v3M9 21h6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
          <span>Falar sobre minha jornada · em breve</span>
        </button>
      </div>

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
        <output aria-live="polite" className="import-processing">
          <span className="import-processing-dot" />
          {' Lendo seus currículos em ordem, como uma máquina faria...'}
        </output>
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

      {documents.length > 0 && !isProcessing && activeDocument ? (
        <section aria-live="polite" className="import-result">
          <div className="import-collection-summary">
            <strong>
              {documents.length}{' '}
              {documents.length === 1 ? 'currículo disponível' : 'currículos disponíveis'}
            </strong>
            <span>Todos serão considerados juntos no começo do processo.</span>
          </div>
          <ul aria-label="Currículos adicionados" className="import-document-list">
            {documents.map((document) => (
              <li key={document.id}>
                <button
                  aria-pressed={document.id === activeDocument.id}
                  className={`import-document-item ${document.id === activeDocument.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setActiveId(document.id);
                    setView('findings');
                  }}
                  type="button"
                >
                  <span>
                    <strong>{document.fileName}</strong>
                    <small>
                      {document.findings.length}{' '}
                      {document.findings.length === 1 ? 'achado' : 'achados'}
                    </small>
                  </span>
                  <span className="import-document-type">{document.fileType}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="import-document-heading">
            <div>
              <p className="text-sm text-[var(--color-text-dim)]">Documento em visualização</p>
              <h2 className="mt-1 font-[family-name:var(--font-heading)] font-semibold text-[var(--color-navy)]">
                {activeDocument.fileName}
              </h2>
            </div>
            <span className="import-document-type">{activeDocument.fileType}</span>
          </div>
          <div className="import-tabs" role="tablist" aria-label="Resultado da leitura">
            <button
              aria-selected={view === 'findings'}
              className={view === 'findings' ? 'is-active' : ''}
              onClick={() => setView('findings')}
              role="tab"
              type="button"
            >
              Diagnóstico agregado
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
          <output aria-live="polite" className="sr-only">
            {allFindings.length}{' '}
            {allFindings.length === 1 ? 'achado encontrado' : 'achados encontrados'} em todos os
            currículos
          </output>
          {view === 'findings' ? (
            <DiagnosticFindings findings={allFindings} />
          ) : (
            <ExtractedTextView text={activeDocument.text} />
          )}
          <div className="import-actions">
            {isConfirmed ? (
              <output className="import-confirmed">
                Currículos prontos para o começo do processo.
              </output>
            ) : (
              <button
                className="button button-primary"
                onClick={() => setIsConfirmed(true)}
                type="button"
              >
                Continuar com estes currículos
              </button>
            )}
            <button
              className="button button-outline button-small"
              onClick={() => void removeActiveDocument()}
              type="button"
            >
              Remover este currículo
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
