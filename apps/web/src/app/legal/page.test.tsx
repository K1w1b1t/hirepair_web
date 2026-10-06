import { render, screen } from '@testing-library/react';
import LegalPage, { metadata } from './page';

describe('LegalPage', () => {
  it('explains optional browser dictation and distinguishes audio from editable text', () => {
    render(<LegalPage />);
    expect(screen.getByText(/O ditado por voz é opcional/i)).toHaveTextContent(
      /áudio pode ser enviado ao serviço de reconhecimento/i,
    );
    expect(screen.getByText(/O ditado por voz é opcional/i)).toHaveTextContent(
      /não armazena a gravação de áudio/i,
    );
    expect(screen.getByRole('link', { name: 'Voltar ao HirePair' })).toHaveAttribute('href', '/');
    expect(screen.getAllByRole('link', { name: 'tech@kiwibit.com.br' })).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Termos de Uso' })).toBeInTheDocument();
    expect(metadata.alternates).toEqual({ canonical: '/legal' });
  });
});
