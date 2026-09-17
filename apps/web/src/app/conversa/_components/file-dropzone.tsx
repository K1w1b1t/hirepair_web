'use client';

import { useRef, type DragEvent, type ChangeEvent } from 'react';

interface FileDropzoneProps {
  readonly onFiles: (files: File[]) => void;
  readonly disabled?: boolean;
}

export function FileDropzone({ onFiles, disabled = false }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) onFiles(files);
    event.target.value = '';
  };

  const dropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) {
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    }
  };

  return (
    <section
      aria-label="Área para anexar currículos"
      className="import-dropzone"
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
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        Escolher arquivo
      </button>
    </section>
  );
}
