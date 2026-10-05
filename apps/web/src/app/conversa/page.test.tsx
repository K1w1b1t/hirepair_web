import { act, fireEvent, render, screen } from '@testing-library/react';
import { clearStoredResumes } from './_lib/resume-storage';
import ConversationPage, { metadata } from './page';

function textFile(content: string, name: string): File {
  const file = new File([content], name, { type: 'text/plain' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
  return file;
}

describe('ConversationPage', () => {
  beforeEach(async () => {
    await clearStoredResumes();
    localStorage.clear();
    window.history.replaceState({}, '', '/conversa');
  });
  it('presents the old resume import step without HR jargon', async () => {
    render(<ConversationPage />);
    await act(async () => undefined);
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

  it('moves from materials to a clean vacancy step without stale content', async () => {
    render(<ConversationPage />);
    const input = screen.getByLabelText(/enviar currículo/i);

    fireEvent.change(input, {
      target: {
        files: [
          textFile('Atendimento ao cliente', 'curriculo.txt'),
          textFile('Analista de suporte', 'experiencia.txt'),
        ],
      },
    });

    expect(await screen.findByText('curriculo.txt')).toBeInTheDocument();
    const summary = screen.getByRole('complementary', { name: 'Resumo dos materiais' });
    expect(await screen.findByRole('button', { name: /^continuar$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pronto para continuar' })).toBeInTheDocument();
    expect(summary.querySelector('.wizard-journey-check svg')).toBeInTheDocument();
    expect(summary.querySelector('.wizard-materials-mark')).not.toBeInTheDocument();
    expect(summary).not.toHaveTextContent(/nenhum deles é tratado como principal/i);

    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));
    await act(async () => undefined);
    expect(window.location.search).toBe('?etapa=job');
    expect(
      screen.queryByRole('complementary', { name: 'Resumo dos materiais' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver resumo/i })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Orientação da análise' })).toHaveTextContent(
      /sugestões aparecerão aqui/i,
    );
    expect(screen.getByText('Passo 2 de 5')).toBeInTheDocument();
    expect(screen.queryByText('Atendimento ao cliente')).not.toBeInTheDocument();
    expect(screen.queryByText('Analista de suporte')).not.toBeInTheDocument();
  });

  it('moves analysis results to a separate recommendation step', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          targetRole: 'Engenheiro mecânico',
          reason: 'Seu histórico aponta para uma transição.',
          summary: 'Encontramos 1 requisito principal para orientar seu currículo.',
          requirements: [{ text: 'Graduação em Engenharia', category: 'ELIMINATORY' }],
          suggestedArchetype: 'B_CAREER_CHANGE',
          suggestedObjective: 'CHANGE_FIELD',
          suggestedTone: 'CONSULTATIVE',
        }),
      });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetchMock });
    render(<ConversationPage />);
    fireEvent.change(screen.getByLabelText(/enviar currículo/i), {
      target: { files: [textFile('Mecânico de manutenção', 'curriculo.txt')] },
    });
    fireEvent.click(await screen.findByRole('button', { name: /^continuar$/i }));
    fireEvent.change(screen.getByLabelText(/requisitos da vaga/i), {
      target: { value: 'Vaga para engenheiro mecânico' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /analisar e sugerir/i }));
    expect(await screen.findByRole('heading', { name: /sugerido para você/i })).toBeInTheDocument();
    expect(window.location.search).toBe('?etapa=recommendations');
    expect(screen.getByText('Passo 3 de 5')).toBeInTheDocument();
    expect(screen.queryByLabelText(/requisitos da vaga/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continuar.*em breve/i })).toBeDisabled();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
  });

  it('has route-specific metadata', () => {
    expect(metadata.title).toMatch(/Conversa/);
    expect(metadata.alternates).toEqual({ canonical: '/conversa' });
  });
});
