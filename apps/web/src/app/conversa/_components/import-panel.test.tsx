import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { clearStoredResumes } from '../_lib/resume-storage';
import { ImportPanel } from './import-panel';

function textFile(content: string, name: string, type: string): File {
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
  return file;
}

describe('ImportPanel', () => {
  beforeEach(async () => {
    await clearStoredResumes();
  });

  it('renders an accessible empty state with upload, paste, and future voice path', () => {
    render(<ImportPanel />);

    expect(screen.getByRole('heading', { name: /jornada profissional/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /escolher arquivo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/colar o texto/i)).toBeInTheDocument();
    const voiceButton = screen.getByRole('button', { name: /falar sobre minha jornada/i });
    expect(voiceButton).toBeDisabled();
    expect(voiceButton.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /escrever do zero/i })).not.toBeInTheDocument();
  });

  it('diagnoses pasted text and exposes the aggregated findings and extracted view', async () => {
    render(<ImportPanel />);
    const textarea = screen.getByLabelText(/colar o texto/i);

    fireEvent.change(textarea, {
      target: { value: 'Experiênciade atendimento. CPF 12345678909.' },
    });

    expect(await screen.findByText(/palavras coladas/i)).toBeInTheDocument();
    expect(screen.getByText(/dado pessoal desnecessário/i)).toBeInTheDocument();
    expect(screen.getByText(/2 achados encontrados em todos os currículos/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /texto como a máquina lê/i }));
    expect(screen.getByText(/o robô do ats enxerga/i)).toBeInTheDocument();
    expect(screen.getByText(/Experiênciade atendimento/)).toBeInTheDocument();
  });

  it('keeps multiple uploaded documents and removes only the active one', async () => {
    render(<ImportPanel />);
    const input = screen.getByLabelText(/enviar currículo/i);
    const first = textFile('Atendimento ao cliente', 'curriculo.txt', 'text/plain');
    const second = textFile('Analista de suporte', 'perfil.md', 'text/markdown');

    fireEvent.change(input, { target: { files: [first, second] } });

    expect(await screen.findByText('2 currículos disponíveis')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /curriculo.txt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /perfil.md/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /remover este currículo/i }));

    await waitFor(() =>
      expect(screen.queryByText('2 currículos disponíveis')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('1 currículo disponível')).toBeInTheDocument();
  });

  it('shows a friendly error for invalid files', async () => {
    render(<ImportPanel />);
    const input = screen.getByLabelText(/enviar currículo/i);
    const file = textFile('conteúdo', 'curriculo.rtf', 'application/rtf');

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/formato ainda não pode ser lido/i);
  });
});
