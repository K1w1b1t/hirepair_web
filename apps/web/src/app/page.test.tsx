import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home', () => {
  it('announces November 1 and keeps one day remaining at the old October 31 deadline', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-31T00:00:00-03:00'));
    try {
      render(<Home />);
      expect(screen.getByText('Lançamento em 1º de novembro')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Volte em 1º de novembro de 2026 para acompanhar o lançamento do HirePair.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('01', { selector: '[data-unit="dias"]' })).toBeInTheDocument();
      expect(screen.queryByText('O lançamento chegou.')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('explains the upcoming product in the main heading', () => {
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
