'use client';

import { useRef, type DragEvent, type ChangeEvent } from 'react';

interface FileDropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function FileDropzone({ onFile, disabled = false }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = '';
  };

  const dropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) {
      const file = event.dataTransfer.files[0];
      if (file) onFile(file);
    }
  };

  return (
    <div
      className="import-dropzone"
      role="region"
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
        type="file"
      />
      <span aria-hidden="true" className="import-file-icon">
        ↑
      </span>
      <p className="font-[family-name:var(--font-heading)] font-semibold text-[var(--color-navy)]">
        Solte seu currículo aqui
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
    </div>
  );
}
