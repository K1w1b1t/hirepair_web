'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ResumePreviewPanelProps {
  readonly children: ReactNode;
  readonly dialogLabel?: string;
  readonly title?: string;
  readonly triggerLabel?: string;
}

export function ResumePreviewPanel({
  children,
  dialogLabel = 'Prévia do currículo',
  title = 'Seu currículo',
  triggerLabel = 'Ver currículo',
}: ResumePreviewPanelProps) {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <>
      <button
        className="wizard-preview-trigger lg:hidden"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>
      {open ? (
        <div aria-label={dialogLabel} aria-modal="true" className="wizard-sheet" role="dialog">
          <button
            aria-label="Fechar ao tocar fora"
            className="wizard-sheet-backdrop"
            type="button"
            onClick={() => setOpen(false)}
          />
          <section className="wizard-sheet-content">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-navy)]">
                {title}
              </h2>
              <button
                ref={closeButton}
                aria-label="Fechar prévia"
                className="wizard-icon-button"
                type="button"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            {children}
          </section>
        </div>
      ) : null}
    </>
  );
}
