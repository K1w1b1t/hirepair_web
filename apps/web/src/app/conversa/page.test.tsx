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

  it('summarizes every imported material without exposing its contents', async () => {
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

    expect(await screen.findByText('2 materiais prontos para análise')).toBeInTheDocument();
    expect(await screen.findByText(/tudo pronto para análise/i)).toBeInTheDocument();
    const summary = screen.getByRole('complementary', { name: 'Resumo dos materiais' });
    expect(summary).toHaveTextContent(/tudo pronto para análise/i);
    expect(summary).toHaveTextContent(/considerar juntos 2 materiais/i);
    expect(summary).toHaveTextContent(/nenhum deles é tratado como principal/i);
    expect(screen.queryByText('Atendimento ao cliente')).not.toBeInTheDocument();
    expect(screen.queryByText('Analista de suporte')).not.toBeInTheDocument();
  });

  it('has route-specific metadata', () => {
    expect(metadata.title).toMatch(/Conversa/);
    expect(metadata.alternates).toEqual({ canonical: '/conversa' });
  });
});
