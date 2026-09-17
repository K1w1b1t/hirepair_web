import { extractTextFromFile } from './extract-text';

describe('extractTextFromFile', () => {
  it('reads plain text files', async () => {
    const file = new File(['Atendimento ao cliente'], 'curriculo.txt', {
      type: 'text/plain',
    });

    await expect(extractTextFromFile(file)).resolves.toMatchObject({
      text: 'Atendimento ao cliente',
      fileName: 'curriculo.txt',
      source: 'file',
    });
  });

  it('reads markdown files as linear text', async () => {
    const file = new File(['# Experiência\n\nAtendimento ao cliente'], 'curriculo.md', {
      type: 'text/markdown',
    });

    await expect(extractTextFromFile(file)).resolves.toMatchObject({
      text: '# Experiência\n\nAtendimento ao cliente',
      fileName: 'curriculo.md',
    });
  });

  it('rejects empty files with a friendly error', async () => {
    const file = new File(['   '], 'curriculo.txt', { type: 'text/plain' });

    await expect(extractTextFromFile(file)).rejects.toThrow('Não encontramos texto nesse arquivo.');
  });

  it('rejects unsupported formats', async () => {
    const file = new File(['conteúdo'], 'curriculo.rtf', { type: 'application/rtf' });

    await expect(extractTextFromFile(file)).rejects.toThrow(
      'Esse formato ainda não pode ser lido aqui.',
    );
  });

  it('rejects files larger than ten megabytes', async () => {
    const file = new File(['x'], 'curriculo.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 });

    await expect(extractTextFromFile(file)).rejects.toThrow(
      'O arquivo precisa ter no máximo 10 MB.',
    );
  });
});
