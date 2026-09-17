import { render, screen } from '@testing-library/react';
import ConversationPage, { metadata } from './page';

describe('ConversationPage', () => {
  it('presents the old resume import step without HR jargon', () => {
    render(<ConversationPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /jornada profissional/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /escolher arquivo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/colar o texto/i)).toBeInTheDocument();
    expect(screen.getByText('Passo 1 de 5')).toBeInTheDocument();
    const backLink = screen.getByRole('link', { name: /voltar para o início/i });
    expect(backLink).toHaveAttribute('href', '/');
    expect(backLink).not.toHaveTextContent('←');
    expect(backLink.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Pair' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/talent acquisition|pipeline|ATS/i);
  });

  it('has route-specific metadata', () => {
    expect(metadata.title).toMatch(/Conversa/);
    expect(metadata.alternates).toEqual({ canonical: '/conversa' });
  });
});
