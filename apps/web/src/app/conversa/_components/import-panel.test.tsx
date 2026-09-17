import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ImportPanel } from './import-panel';

describe('ImportPanel', () => {
  it('renders an accessible empty state with upload and paste options', () => {
    render(<ImportPanel />);

    expect(screen.getByRole('heading', { name: /currículo antigo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /escolher arquivo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/colar o texto/i)).toBeInTheDocument();
    expect(screen.getByText(/pdf, docx, txt ou md/i)).toBeInTheDocument();
  });

  it('diagnoses pasted text and lets the user switch to the extracted view', async () => {
    render(<ImportPanel />);
    const textarea = screen.getByLabelText(/colar o texto/i);

    fireEvent.change(textarea, {
      target: { value: 'Experiênciade atendimento. CPF 12345678909.' },
    });

    expect(await screen.findByText(/palavras coladas/i)).toBeInTheDocument();
    expect(screen.getByText(/dado pessoal desnecessário/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/2 achados/i);

    fireEvent.click(screen.getByRole('tab', { name: /texto como a máquina lê/i }));
    expect(screen.getByText(/o robô do ats enxerga/i)).toBeInTheDocument();
    expect(screen.getByText(/Experiênciade atendimento/)).toBeInTheDocument();
  });

  it('accepts a text file and confirms the document', async () => {
    const onDocumentChange = jest.fn();
    render(<ImportPanel onDocumentChange={onDocumentChange} />);
    const input = screen.getByLabelText(/enviar currículo/i);
    const file = new File(['Atendimento ao cliente'], 'curriculo.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('curriculo.txt')).toBeInTheDocument();
    expect(onDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'curriculo.txt' }),
    );
    fireEvent.click(screen.getByRole('button', { name: /continuar com este currículo/i }));
    await waitFor(() => expect(screen.getByText(/currículo confirmado/i)).toBeInTheDocument());
  });

  it('shows a friendly error for invalid files and allows replacing them', async () => {
    render(<ImportPanel />);
    const input = screen.getByLabelText(/enviar currículo/i);
    const file = new File(['conteúdo'], 'curriculo.rtf', { type: 'application/rtf' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/formato ainda não pode ser lido/i);
    expect(screen.getByRole('button', { name: /trocar de arquivo/i })).toBeInTheDocument();
  });
});
