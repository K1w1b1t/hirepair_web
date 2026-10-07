import { render, screen } from '@testing-library/react';
import LegalPage, { metadata } from './page';
it('explains external processing, local retention and the independent cookie choice', () => {
  render(<LegalPage />);
  expect(
    screen.getByRole('heading', { name: 'Privacidade, cookies e termos' }),
  ).toBeInTheDocument();
  expect(screen.getByText(/A análise usa o Groq/)).toHaveTextContent(/não garante anonimização/);
  expect(screen.getByText(/A análise usa o Groq/)).toHaveTextContent(/sem expiração automática/);
  expect(screen.getByText(/Para proteger o serviço/)).toHaveTextContent(/até 30 dias/);
  expect(screen.getByText(/O ditado por voz é opcional/i)).toHaveTextContent(
    /não armazena a gravação de áudio/i,
  );
  expect(metadata.alternates).toEqual({ canonical: '/legal' });
});
