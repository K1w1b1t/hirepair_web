import { render, screen } from '@testing-library/react';
import ConversationPage, { metadata } from './page';

describe('ConversationPage', () => {
  it('presents a welcoming first wizard step without HR jargon', () => {
    render(<ConversationPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /vamos montar seu currículo/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Passo 1 de 5')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('link', { name: /voltar para o início/i })).toHaveAttribute(
      'href',
      '/',
    );
    expect(document.body.textContent).not.toMatch(/talent acquisition|pipeline|ATS/i);
  });

  it('has route-specific metadata', () => {
    expect(metadata.title).toMatch(/Conversa/);
    expect(metadata.alternates).toEqual({ canonical: '/conversa' });
  });
});
