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

function createPastedResume(value: string): StoredResume {
  const document = {
    ...extractedTextFromPaste(value),
    fileName: 'Adicionado manualmente',
  };
  return toStoredResume(document, diagnoseResumeText(document.text));
}

function ImportErrorToast({
  messages,
  onDismiss,
}: {
  readonly messages: string[];
  readonly onDismiss: () => void;
}) {
  useEffect(() => {
    if (messages.length === 0) return;

    const timeout = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timeout);
  }, [messages, onDismiss]);

  if (messages.length === 0) return null;

  return (
    <div aria-live="assertive" className="import-toast" role="alert">
      <div>
        <strong>Não foi possível adicionar alguns arquivos.</strong>
        <ul aria-label="Arquivos não lidos" className="import-error-list">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
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

export function ImportPanel({ onDocumentsChange }: ImportPanelProps) {
  const [documents, setDocuments] = useState<StoredResume[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string[]>([]);
  const [pastedText, setPastedText] = useState('');
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
          file.name + ': ' + (error_ instanceof Error ? error_.message : 'não foi possível ler.'),
        );
      }
    }
    if (errors.length > 0) setError(errors);
    setIsProcessing(false);
  };

  const handlePaste = () => {
    if (!pastedText.trim()) return;

    try {
      hasLocalChanges.current = true;
      const storedDocument = createPastedResume(pastedText);
      void saveStoredResume(storedDocument);
      setDocuments((current) => [...current, storedDocument]);
      setPastedText('');
      setError([]);
    } catch (error_) {
      setError([
        error_ instanceof Error ? error_.message : 'Não encontramos texto nesse material.',
      ]);
    }
  };

  const removeDocument = async (id: string) => {
    await deleteStoredResume(id);
    setDocuments((current) => current.filter((item) => item.id !== id));
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

      <FileDropzone
        disabled={isProcessing}
        documents={documents}
        onFiles={handleFiles}
        onRemove={(id) => void removeDocument(id)}
      />

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
          onChange={(event) => setPastedText(event.target.value)}
          placeholder="Cole aqui o conteúdo do currículo"
          rows={5}
          value={pastedText}
        />
        <div className="import-paste-actions">
          <button
            className="button button-primary button-small"
            disabled={!pastedText.trim()}
            onClick={handlePaste}
            type="button"
          >
            Adicionar material
          </button>
        </div>
      </div>

      <ImportErrorToast messages={error} onDismiss={() => setError([])} />
    </div>
  );
}
