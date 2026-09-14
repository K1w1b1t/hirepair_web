import type { Metadata } from 'next';
import { WizardShell } from './_components/wizard-shell';

export const metadata: Metadata = {
  title: 'Conversa | HirePair',
  description: 'Monte seu currículo com perguntas simples, uma etapa de cada vez.',
  alternates: { canonical: '/conversa' },
};

const preview = (
  <div className="wizard-empty-preview">
    <span aria-hidden="true" className="wizard-paper-mark" />
    <p className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-navy)]">
      Seu currículo começa aqui
    </p>
    <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--color-text-muted)]">
      Ele vai aparecer aqui enquanto a gente conversa.
    </p>
  </div>
);

export default function ConversationPage() {
  return (
    <WizardShell currentStep={1} preview={preview} totalSteps={5}>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-10 sm:py-16">
        <p className="section-kicker">Uma pergunta de cada vez</p>
        <h1 className="mt-4 text-balance font-[family-name:var(--font-heading)] text-4xl font-medium leading-tight tracking-[-0.025em] text-[var(--color-navy)] sm:text-5xl">
          Vamos montar seu currículo juntos.
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-8 text-[var(--color-text-muted)]">
          Você não precisa saber o que escrever. A gente vai por partes, com perguntas simples e no
          seu ritmo.
        </p>
        <div className="mt-8 self-start rounded-[1.25rem_1.25rem_1.25rem_0.35rem] border border-black/5 bg-[var(--color-creme)] px-5 py-4 leading-7 shadow-sm">
          Quando as próximas etapas forem adicionadas, você poderá começar com um currículo que já
          tem ou do zero.
        </div>
      </div>
    </WizardShell>
  );
}
