'use client';

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { StoredResume } from '../_lib/resume-storage';

interface FileDropzoneProps {
  readonly documents: StoredResume[];
  readonly onFiles: (files: File[]) => void;
  readonly onRemove: (id: string) => void;
  readonly disabled?: boolean;
}

export function FileDropzone({
  documents,
  onFiles,
  onRemove,
  disabled = false,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragDepth, setDragDepth] = useState(0);
  const [openedDocumentId, setOpenedDocumentId] = useState<string | null>(null);
  const isDragging = dragDepth > 0;

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) onFiles(files);
    event.target.value = '';
  };

  const dragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!disabled && Array.from(event.dataTransfer.types).includes('Files')) {
      setDragDepth((current) => current + 1);
    }
  };

  const dragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragDepth((current) => Math.max(0, current - 1));
  };

  const dropFile = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragDepth(0);
    if (!disabled) {
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    }
  };

  const openFilePicker = () => inputRef.current?.click();
  const hasDocuments = documents.length > 0;

  return (
    <section
      aria-label="Área para anexar currículos"
      className={[
        'import-dropzone',
        hasDocuments ? 'has-documents' : '',
        isDragging ? 'is-dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onDragEnter={dragEnter}
      onDragLeave={dragLeave}
      onDragOver={(event) => event.preventDefault()}
      onDrop={dropFile}
    >
      <input
        ref={inputRef}
        accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
        aria-label="Enviar currículo"
        className="sr-only"
        disabled={disabled}
        onChange={selectFile}
        multiple
        type="file"
      />

      {!hasDocuments ? (
        <>
          <span aria-hidden="true" className="import-file-icon">
            ↑
          </span>
          <p className="font-[family-name:var(--font-heading)] font-semibold text-[var(--color-navy)]">
            Solte seus currículos aqui
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            PDF, DOCX, TXT ou MD · até 10 MB
          </p>
          <button
            className="button button-outline mt-5"
            disabled={disabled}
            onClick={openFilePicker}
            type="button"
          >
            Escolher arquivo
          </button>
        </>
      ) : (
        <>
          <ul aria-label="Materiais adicionados" className="import-document-list">
            {documents.map((document) => {
              const isOpen = openedDocumentId === document.id;
              const previewId = 'material-' + document.id;

              return (
                <li className="import-document-item" key={document.id}>
                  <div className="import-document-row">
                    <button
                      aria-controls={previewId}
                      aria-expanded={isOpen}
                      aria-label={(isOpen ? 'Ocultar ' : 'Ver ') + document.fileName}
                      className="import-document-preview-trigger"
                      onClick={() => setOpenedDocumentId(isOpen ? null : document.id)}
                      type="button"
                    >
                      <span aria-hidden="true" className="import-document-file-icon">
                        <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
                          <path
                            d="M7 3.5h6.2L18 8.3v12.2H7V3.5Z"
                            stroke="currentColor"
                            strokeLinejoin="round"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M13 3.5v5h5M9.5 13h5M9.5 16.5h5"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </span>
                      <span className="import-document-details">
                        <strong>{document.fileName}</strong>
                        <small>{document.fileType}</small>
                      </span>
                    </button>
                    <button
                      aria-label={'Remover ' + document.fileName}
                      className="import-remove-button"
                      disabled={disabled}
                      onClick={() => onRemove(document.id)}
                      type="button"
                    >
                      Remover
                    </button>
                  </div>
                  {isOpen ? (
                    <article
                      aria-label={'Conteúdo de ' + document.fileName}
                      className="import-document-preview"
                      id={previewId}
                    >
                      {document.text}
                    </article>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="import-add-files">
            <span>Arraste mais documentos para este card</span>
            <button
              className="button button-outline button-small"
              disabled={disabled}
              onClick={openFilePicker}
              type="button"
            >
              Adicionar mais arquivos
            </button>
          </div>
        </>
      )}

      {disabled ? (
        <output aria-live="polite" className="import-card-processing">
          Lendo seus materiais…
        </output>
      ) : null}
    </section>
  );
}
