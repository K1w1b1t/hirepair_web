import { extractTextFromFile } from './extract-text';

function textFile(content: string, name: string, type: string): File {
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
  return file;
}

describe('extractTextFromFile', () => {
  it('reads plain text files', async () => {
    const file = textFile('Atendimento ao cliente', 'curriculo.txt', 'text/plain');

    await expect(extractTextFromFile(file)).resolves.toMatchObject({
      text: 'Atendimento ao cliente',
      fileName: 'curriculo.txt',
      source: 'file',
    });
  });

  it('reads markdown files as linear text', async () => {
    const file = textFile(
      '# Experiência\n\nAtendimento ao cliente',
      'curriculo.md',
      'text/markdown',
    );

    await expect(extractTextFromFile(file)).resolves.toMatchObject({
      text: '# Experiência\n\nAtendimento ao cliente',
      fileName: 'curriculo.md',
    });
  });

  it('rejects empty files with a friendly error', async () => {
    const file = textFile('   ', 'curriculo.txt', 'text/plain');

    await expect(extractTextFromFile(file)).rejects.toThrow('Não encontramos texto nesse arquivo.');
  });

  it('rejects unsupported formats', async () => {
    const file = textFile('conteúdo', 'curriculo.rtf', 'application/rtf');

    await expect(extractTextFromFile(file)).rejects.toThrow(
      'Esse formato ainda não pode ser lido aqui.',
    );
  });

  it('rejects files larger than ten megabytes', async () => {
    const file = textFile('x', 'curriculo.txt', 'text/plain');
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 });

    await expect(extractTextFromFile(file)).rejects.toThrow(
      'O arquivo precisa ter no máximo 10 MB.',
    );
  });
});
