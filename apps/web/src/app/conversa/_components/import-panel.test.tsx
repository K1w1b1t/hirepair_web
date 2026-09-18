import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('renders an accessible empty state with upload, paste, and future voice path', async () => {
    render(<ImportPanel />);
    await act(async () => undefined);

    expect(screen.getByRole('heading', { name: /jornada profissional/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /escolher arquivo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/colar o texto/i)).toBeInTheDocument();
    const voiceButton = screen.getByRole('button', { name: /falar sobre minha jornada/i });
    expect(voiceButton).toBeDisabled();
    expect(voiceButton.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /escrever do zero/i })).not.toBeInTheDocument();
  });

  it('lists pasted text as material without exposing extracted content or diagnostics', async () => {
    render(<ImportPanel />);
    const textarea = screen.getByLabelText(/colar o texto/i);

    fireEvent.change(textarea, {
      target: { value: 'Experiênciade atendimento. CPF 12345678909.' },
    });

    expect(await screen.findByText(/texto colado/i)).toBeInTheDocument();
    expect(screen.getByText(/1 material pronto para análise/i)).toBeInTheDocument();
    expect(screen.getAllByText(/pronto para análise/i)).toHaveLength(2);
    expect(screen.queryByText(/dado pessoal desnecessário/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Experiênciade atendimento/)).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('presents multiple documents with equal importance and removes the chosen one', async () => {
    render(<ImportPanel />);
    const input = screen.getByLabelText(/enviar currículo/i);
    const first = textFile('Atendimento ao cliente', 'curriculo.txt', 'text/plain');
    const second = textFile('Analista de suporte', 'perfil.md', 'text/markdown');

    fireEvent.change(input, { target: { files: [first, second] } });

    expect(await screen.findByText('2 materiais prontos para análise')).toBeInTheDocument();
    expect(screen.getByText('curriculo.txt')).toBeInTheDocument();
    expect(screen.getByText('perfil.md')).toBeInTheDocument();
    expect(screen.getAllByText(/pronto para análise/i)).toHaveLength(2);
    expect(screen.queryByText(/documento em visualização/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/achados/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remover curriculo.txt/i }));

    await waitFor(() =>
      expect(screen.queryByText('2 materiais prontos para análise')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('1 material pronto para análise')).toBeInTheDocument();
    expect(screen.queryByText('curriculo.txt')).not.toBeInTheDocument();
    expect(screen.getByText('perfil.md')).toBeInTheDocument();
  });

  it('shows a friendly error for invalid files', async () => {
    render(<ImportPanel />);
    const input = screen.getByLabelText(/enviar currículo/i);
    const first = textFile('conteúdo', 'curriculo.rtf', 'application/rtf');
    const second = textFile('imagem', 'foto.png', 'image/png');

    fireEvent.change(input, { target: { files: [first, second] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/formato ainda não pode ser lido/i);
    const errorList = screen.getByRole('list', { name: 'Arquivos não lidos' });
    expect(errorList.children).toHaveLength(2);
    expect(errorList).toHaveTextContent('curriculo.rtf');
    expect(errorList).toHaveTextContent('foto.png');
  });
});
