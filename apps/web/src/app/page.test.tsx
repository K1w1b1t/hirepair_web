jest.mock('./journey-resume', () => ({ JourneyResume: () => null }));
import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home', () => {
  it('presents the available product and preserves the journey links without launch messaging', () => {
    render(<Home />);

    expect(screen.getByText('Seu currículo começa aqui')).toBeInTheDocument();
    expect(screen.getByText('O que o HirePair oferece')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Começar a conversa' })).toHaveAttribute(
      'href',
      '/conversa',
    );
    expect(screen.getByRole('link', { name: 'Meus currículos' })).toHaveAttribute(
      'href',
      '/meus-curriculos',
    );
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/lançamento|contagem regressiva|1º de novembro/i);
  });

  it('explains the product in the main heading', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Um currículo claro para abrir portas.' }),
    ).toBeInTheDocument();
  });

  it('describes the three product principles for visitors and search engines', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', { level: 3, name: 'Passo a passo, sem complicação' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Feito para processos seletivos' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Seu currículo pronto para compartilhar' }),
    ).toBeInTheDocument();
  });

  it('offers direct contact through WhatsApp and email', () => {
    render(<Home />);

    for (const link of screen.getAllByRole('link', { name: /conversar pelo whatsapp/i })) {
      expect(link).toHaveAttribute('href', expect.stringContaining('https://wa.me/5511913165266'));
    }
    for (const link of screen.getAllByRole('link', { name: /enviar um e-mail/i })) {
      expect(link).toHaveAttribute(
        'href',
        'mailto:tech@kiwibit.com.br?subject=Quero%20conhecer%20o%20HirePair',
      );
    }
  });

  it('links to the legal information', () => {
    render(<Home />);
    expect(screen.getByRole('link', { name: 'Privacidade, cookies e termos' })).toHaveAttribute(
      'href',
      '/legal',
    );
  });

  it('renders the official HirePair logo', () => {
    render(<Home />);

    expect(screen.getAllByRole('img', { name: 'HirePair' })).toHaveLength(2);
  });
});
