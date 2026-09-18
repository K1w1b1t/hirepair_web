'use client';

import { useEffect, useRef, useState } from 'react';
import { diagnoseResumeText } from '../_lib/diagnostic';
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
import { FileDropzone } from './file-dropzone';

export interface ImportPanelProps {
  readonly onDocumentsChange?: (documents: StoredResume[]) => void;
}

function createPastedResume(value: string, documents: StoredResume[]): StoredResume {
  const document = extractedTextFromPaste(value);
  const findings = diagnoseResumeText(document.text);
  const previous = documents.find((item) => item.source === 'pasted');
  if (previous) return { ...previous, text: document.text, findings };
  return toStoredResume(document, findings);
}

export function ImportPanel({ onDocumentsChange }: ImportPanelProps) {
  const [documents, setDocuments] = useState<StoredResume[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<string[]>([]);
  const hasLocalChanges = useRef(false);

  useEffect(() => {
    let mounted = true;
    void listStoredResumes().then((storedResumes) => {
      if (!mounted) return;
      if (!hasLocalChanges.current) {
        setDocuments(storedResumes);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    onDocumentsChange?.(documents);
  }, [documents, onDocumentsChange]);

  const addDocument = async (document: ExtractedText) => {
    hasLocalChanges.current = true;
    const storedDocument = toStoredResume(document, diagnoseResumeText(document.text));
    await saveStoredResume(storedDocument);
    setDocuments((current) => [...current, storedDocument]);
    setIsConfirmed(false);
  };

  const handleFiles = async (files: File[]) => {
    setIsProcessing(true);
    setError([]);
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
    if (errors.length > 0) setError(errors);
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
      setIsConfirmed(false);
      setError([]);
    } catch (error_) {
      setError([error_ instanceof Error ? error_.message : 'Não encontramos texto nesse arquivo.']);
    }
  };

  const removeDocument = async (id: string) => {
    await deleteStoredResume(id);
    setDocuments((current) => current.filter((item) => item.id !== id));
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
          Envie um ou mais currículos. Tudo o que você adicionar será considerado junto na análise.
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

      {error.length > 0 ? (
        <div aria-live="polite" className="import-error" role="alert">
          <strong>Não conseguimos ler alguns documentos.</strong>
          <ul aria-label="Arquivos não lidos" className="import-error-list">
            {error.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <button
            className="button button-outline button-small mt-3"
            onClick={() => setError([])}
            type="button"
          >
            Trocar de arquivo
          </button>
        </div>
      ) : null}

      {documents.length > 0 && !isProcessing ? (
        <section aria-live="polite" className="import-result">
          <div className="import-collection-summary">
            <strong>
              {documents.length}{' '}
              {documents.length === 1
                ? 'material pronto para análise'
                : 'materiais prontos para análise'}
            </strong>
            <span>Todos serão considerados juntos. Nenhum é tratado como principal.</span>
          </div>
          <ul aria-label="Materiais adicionados" className="import-document-list">
            {documents.map((document) => (
              <li className="import-document-item" key={document.id}>
                <span aria-hidden="true" className="import-document-ready-icon">
                  ✓
                </span>
                <span className="import-document-details">
                  <strong>{document.fileName}</strong>
                  <small>Pronto para análise</small>
                </span>
                <span className="import-document-type">{document.fileType}</span>
                <button
                  aria-label={'Remover ' + document.fileName}
                  className="import-remove-button"
                  onClick={() => void removeDocument(document.id)}
                  type="button"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
          <div className="import-actions">
            {isConfirmed ? (
              <output className="import-confirmed">
                Materiais confirmados. Tudo vai entrar na análise.
              </output>
            ) : (
              <button
                className="button button-primary"
                onClick={() => setIsConfirmed(true)}
                type="button"
              >
                Continuar com estes materiais
              </button>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
