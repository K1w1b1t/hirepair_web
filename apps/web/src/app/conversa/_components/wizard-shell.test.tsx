import { render, screen } from '@testing-library/react';
import { WizardShell } from './wizard-shell';
it('uses accessible preview defaults and offers home navigation outside the interview', () => {
  render(
    <WizardShell currentStep={1} totalSteps={5} preview={<p>Prévia</p>}>
      Entrada
    </WizardShell>,
  );
  expect(screen.getByRole('link', { name: 'Voltar para o início' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ver currículo' })).toBeInTheDocument();
});
it('retains home navigation and a standalone footer in a focused interview', () => {
  render(
    <WizardShell focused currentStep={4} totalSteps={5} preview={null} footer={<p>Rodapé</p>}>
      Pergunta
    </WizardShell>,
  );
  expect(screen.getByText('Rodapé')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Voltar para o início' })).toHaveAttribute('href', '/');
});
