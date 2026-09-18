import { act, fireEvent, render, screen } from '@testing-library/react';
import ConversationPage, { metadata } from './page';

function textFile(content: string, name: string): File {
  const file = new File([content], name, { type: 'text/plain' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
  return file;
}

describe('ConversationPage', () => {
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

  it('prepares the next step after imports and keeps materials inspectable only on demand', async () => {
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
    expect(await screen.findByRole('button', { name: /^iniciar$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Iniciar' })).toBeInTheDocument();
    expect(summary.querySelector('.wizard-journey-check svg')).toBeInTheDocument();
    expect(summary.querySelector('.wizard-materials-mark')).not.toBeInTheDocument();
    expect(summary).not.toHaveTextContent(/nenhum deles é tratado como principal/i);

    fireEvent.click(screen.getByRole('button', { name: /^iniciar$/i }));
    await act(async () => undefined);
    expect(summary).toHaveTextContent(/sua jornada está pronta para começar/i);
    expect(screen.queryByText('Atendimento ao cliente')).not.toBeInTheDocument();
    expect(screen.queryByText('Analista de suporte')).not.toBeInTheDocument();
  });

  it('has route-specific metadata', () => {
    expect(metadata.title).toMatch(/Conversa/);
    expect(metadata.alternates).toEqual({ canonical: '/conversa' });
  });
});
