import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { clearStoredResumes } from '../_lib/resume-storage';
import { ImportPanel } from './import-panel';
import * as extraction from '../_lib/extract-text';
import * as storage from '../_lib/resume-storage';
import {
  installSpeechRecognition,
  MockSpeechRecognition,
} from '../../../../test/mock-speech-recognition';

jest.mock('../_lib/extract-text', () => {
  const actual = jest.requireActual<typeof import('../_lib/extract-text')>('../_lib/extract-text');
  return {
    ...actual,
    extractTextFromFile: jest.fn(actual.extractTextFromFile),
    extractedTextFromPaste: jest.fn(actual.extractedTextFromPaste),
  };
});

jest.mock('../_lib/resume-storage', () => {
  const actual =
    jest.requireActual<typeof import('../_lib/resume-storage')>('../_lib/resume-storage');
  return { ...actual, listStoredResumes: jest.fn(actual.listStoredResumes) };
});

function textFile(content: string, name: string, type: string): File {
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
  return file;
}

describe('ImportPanel', () => {
  beforeEach(async () => {
    await clearStoredResumes();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders an accessible empty state with upload and paste when dictation is unavailable', async () => {
    render(<ImportPanel />);
    await act(async () => undefined);

    expect(screen.getByRole('heading', { name: /jornada profissional/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /escolher arquivo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/colar o texto/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /falar para preencher/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /escrever do zero/i })).not.toBeInTheDocument();
  });

  it('adds spoken material through the existing text action after dictation ends', async () => {
    const restore = installSpeechRecognition();
    try {
      render(<ImportPanel />);
      await act(async () => undefined);
      fireEvent.click(screen.getByRole('button', { name: /falar para preencher/i }));
      const recognition = MockSpeechRecognition.instances[0];
      act(() => recognition.onstart?.());
      act(() => recognition.result(['Atendimento ao cliente.']));
      expect(screen.getByRole('button', { name: /adicionar material/i })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: /confirmar ditado/i }));
      expect(screen.getByRole('button', { name: /adicionar material/i })).toBeDisabled();
      act(() => recognition.onend?.());
      expect(screen.getByLabelText(/colar o texto/i)).toHaveValue('Atendimento ao cliente.');
      fireEvent.click(screen.getByRole('button', { name: /adicionar material/i }));
      expect(await screen.findByText(/adicionado manualmente/i)).toBeInTheDocument();
    } finally {
      restore();
    }
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

  it('ignores restoration that finishes after the panel is unmounted', async () => {
    let resolveStored!: (items: storage.StoredResume[]) => void;
    jest.spyOn(storage, 'listStoredResumes').mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStored = resolve;
      }),
    );
    const onDocumentsChange = jest.fn();
    const { unmount } = render(<ImportPanel onDocumentsChange={onDocumentsChange} />);
    onDocumentsChange.mockClear();
    unmount();
    await act(async () => resolveStored([]));
    expect(onDocumentsChange).not.toHaveBeenCalled();
  });

  it('preserves new material when delayed restoration finishes', async () => {
    let resolveStored!: (items: storage.StoredResume[]) => void;
    jest.spyOn(storage, 'listStoredResumes').mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStored = resolve;
      }),
    );
    render(<ImportPanel />);
    fireEvent.change(screen.getByLabelText(/colar o texto/i), {
      target: { value: 'Atendimento ao cliente.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar material' }));
    await act(async () => resolveStored([]));
    expect(screen.getByText('Adicionado manualmente')).toBeInTheDocument();
  });

  it.each([
    [new Error('Falha ao ler o texto.'), 'Falha ao ler o texto.'],
    ['unknown failure', 'Não encontramos texto nesse material.'],
  ])('preserves text if manual material extraction fails: %s', async (failure, expected) => {
    jest.spyOn(extraction, 'extractedTextFromPaste').mockImplementationOnce(() => {
      throw failure;
    });
    render(<ImportPanel />);
    await act(async () => undefined);
    fireEvent.change(screen.getByLabelText(/colar o texto/i), {
      target: { value: 'Experiência profissional.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar material' }));
    expect(screen.getByRole('alert')).toHaveTextContent(expected);
    expect(screen.getByLabelText(/colar o texto/i)).toHaveValue('Experiência profissional.');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports an unknown file extraction failure without exposing its value', async () => {
    jest.spyOn(extraction, 'extractTextFromFile').mockRejectedValueOnce('unexpected failure');
    render(<ImportPanel />);
    await act(async () => undefined);
    fireEvent.change(screen.getByLabelText(/enviar currículo/i), {
      target: { files: [textFile('Texto', 'curriculo.txt', 'text/plain')] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'curriculo.txt: não foi possível ler.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('unexpected failure');
  });
});
