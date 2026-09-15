import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ResumePreviewPanel } from './resume-preview-panel';

export interface WizardShellProps {
  currentStep: number;
  totalSteps: number;
  children: ReactNode;
  preview: ReactNode;
  footer?: ReactNode;
}

export function WizardShell({
  currentStep,
  totalSteps,
  children,
  preview,
  footer,
}: WizardShellProps) {
  const progress = `${(currentStep / totalSteps) * 100}%`;
  return (
    <div className="wizard-page">
      <header className="wizard-header">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link aria-label="Voltar para o início" className="wizard-icon-button" href="/">
              <svg
                aria-hidden="true"
                fill="none"
                height="20"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="20"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <Image
              alt=""
              className="h-9 w-auto"
              height={41}
              priority
              src="/hirepair-logo.png"
              width={34}
            />
            <span className="font-[family-name:var(--font-heading)] font-semibold text-[var(--color-navy)]">
              Pair
            </span>
          </div>
          <span className="text-xs text-[var(--color-text-dim)]">
            Passo {currentStep} de {totalSteps}
          </span>
        </div>
        <div
          aria-label="Progresso do currículo"
          aria-valuemax={totalSteps}
          aria-valuemin={1}
          aria-valuenow={currentStep}
          className="wizard-progress"
          role="progressbar"
        >
          <span style={{ width: progress }} />
        </div>
      </header>
      <div className="wizard-layout">
        <main className="wizard-conversation">{children}</main>
        <aside aria-label="Prévia do currículo" className="wizard-preview-desktop">
          {preview}
        </aside>
      </div>
      <footer className="wizard-footer">
        <ResumePreviewPanel>{preview}</ResumePreviewPanel>
        {footer}
      </footer>
    </div>
  );
}
