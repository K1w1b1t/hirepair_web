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

  it('brightens the upload card while a document is dragged over it', async () => {
    render(<ImportPanel />);
    await act(async () => undefined);
    const dropzone = screen.getByRole('region', { name: /área para anexar currículos/i });

    fireEvent.dragEnter(dropzone, { dataTransfer: { types: ['Files'] } });

    expect(dropzone).toHaveClass('is-dragging');

    fireEvent.dragLeave(dropzone, { dataTransfer: { types: ['Files'] } });

    expect(dropzone).not.toHaveClass('is-dragging');
  });

  it('only enables manual addition after text is provided and lets the user inspect it', async () => {
    render(<ImportPanel />);
    const textarea = screen.getByLabelText(/colar o texto/i);
    const addButton = screen.getByRole('button', { name: /adicionar material/i });

    expect(addButton).toBeDisabled();

    fireEvent.change(textarea, {
      target: { value: 'Experiênciade atendimento. CPF 12345678909.' },
    });

    expect(addButton).toBeEnabled();
    expect(screen.queryByText(/adicionado manualmente/i)).not.toBeInTheDocument();

    fireEvent.click(addButton);

    expect(await screen.findByText(/adicionado manualmente/i)).toBeInTheDocument();
    expect(screen.queryByText(/dado pessoal desnecessário/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Experiênciade atendimento/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^ver adicionado manualmente/i }));

    expect(screen.getByText(/Experiênciade atendimento/)).toBeInTheDocument();
  });

  it('turns the upload card into an expandable list that accepts more documents', async () => {
    render(<ImportPanel />);
    const input = screen.getByLabelText(/enviar currículo/i);
    const first = textFile('Atendimento ao cliente', 'curriculo.txt', 'text/plain');
    const second = textFile('Analista de suporte', 'perfil.md', 'text/markdown');

    fireEvent.change(input, { target: { files: [first, second] } });

    expect(await screen.findByText('curriculo.txt')).toBeInTheDocument();
    expect(screen.getByText('perfil.md')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /adicionar mais arquivos/i })).toBeInTheDocument();
    expect(screen.queryByText(/materiais prontos para análise/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nenhum.*principal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/documento em visualização/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/achados/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remover curriculo.txt/i }));

    await waitFor(() => expect(screen.queryByText('curriculo.txt')).not.toBeInTheDocument());
    expect(screen.getByText('perfil.md')).toBeInTheDocument();
  });

  it('shows invalid file errors in a temporary toast without taking layout space', async () => {
    jest.useFakeTimers();
    render(<ImportPanel />);
    const input = screen.getByLabelText(/enviar currículo/i);
    const first = textFile('conteúdo', 'curriculo.rtf', 'application/rtf');
    const second = textFile('imagem', 'foto.png', 'image/png');

    fireEvent.change(input, { target: { files: [first, second] } });

    expect(await screen.findByRole('alert')).toHaveClass('import-toast');
    expect(screen.getByRole('alert')).toHaveTextContent(/formato ainda não pode ser lido/i);
    const errorList = screen.getByRole('list', { name: 'Arquivos não lidos' });
    expect(errorList.children).toHaveLength(2);
    expect(errorList).toHaveTextContent('curriculo.rtf');
    expect(errorList).toHaveTextContent('foto.png');

    act(() => jest.advanceTimersByTime(5000));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});
