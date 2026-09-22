import { extractTextFromFile, extractedTextFromPaste } from './extract-text';

const mockGetDocument = jest.fn();
const mockExtractRawText = jest.fn();

jest.mock('pdfjs-dist/legacy/build/pdf.worker.mjs', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  __esModule: true,
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}));

jest.mock('mammoth/mammoth.browser', () => ({
  __esModule: true,
  extractRawText: (...args: unknown[]) => mockExtractRawText(...args),
}));

function textFile(content: string, name: string, type: string): File {
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
  return file;
}

function binaryFile(content: string, name: string, type: string): File {
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(Buffer.from(content).buffer),
  });
  return file;
}

describe('extractTextFromFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads plain text files', async () => {
    const file = textFile('Atendimento ao cliente\r\nSegunda linha', 'curriculo.txt', 'text/plain');

    await expect(extractTextFromFile(file)).resolves.toEqual({
      text: 'Atendimento ao cliente\nSegunda linha',
      fileName: 'curriculo.txt',
      source: 'file',
      fileType: 'TXT',
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
      fileType: 'MD',
      source: 'file',
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

  it('extracts text from a single-page PDF', async () => {
    const file = binaryFile('%PDF-1.4 mock', 'curriculo.pdf', 'application/pdf');

    mockGetDocument.mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 1,
        getPage: jest.fn().mockResolvedValue({
          getTextContent: jest.fn().mockResolvedValue({
            items: [
              { str: 'Gabriel Rodrigues' },
              { otherProp: 123 },
              { str: 'Engenheiro de software' },
            ],
          }),
        }),
      }),
    });

    await expect(extractTextFromFile(file)).resolves.toEqual({
      text: 'Gabriel Rodrigues Engenheiro de software',
      fileName: 'curriculo.pdf',
      source: 'file',
      fileType: 'PDF',
    });
    expect(mockGetDocument).toHaveBeenCalledWith({
      data: expect.anything(),
      disableWorker: true,
    });
  });

  it('concatenates text from multiple PDF pages with line breaks', async () => {
    const file = binaryFile('%PDF-1.4 multi', 'curriculo.pdf', 'application/pdf');

    mockGetDocument.mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 2,
        getPage: jest
          .fn()
          .mockResolvedValueOnce({
            getTextContent: jest.fn().mockResolvedValue({
              items: [{ str: 'Primeira página' }],
            }),
          })
          .mockResolvedValueOnce({
            getTextContent: jest.fn().mockResolvedValue({
              items: [{ str: 'Segunda página' }],
            }),
          }),
      }),
    });

    await expect(extractTextFromFile(file)).resolves.toEqual({
      text: 'Primeira página\nSegunda página',
      fileName: 'curriculo.pdf',
      source: 'file',
      fileType: 'PDF',
    });
  });

  it('handles PDF parser errors gracefully', async () => {
    const file = binaryFile('corrupted data', 'curriculo.pdf', 'application/pdf');

    mockGetDocument.mockImplementationOnce(() => {
      const promise = Promise.reject(new Error('Invalid PDF structure'));
      promise.catch(() => {});
      return { promise };
    });

    await expect(extractTextFromFile(file)).rejects.toThrow(
      'Não foi possível ler esse arquivo. Tente outro arquivo ou cole o texto.',
    );
  });

  it('rejects PDF files that contain no extracted text', async () => {
    const file = binaryFile('%PDF-1.4 empty', 'curriculo.pdf', 'application/pdf');

    mockGetDocument.mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 1,
        getPage: jest.fn().mockResolvedValue({
          getTextContent: jest.fn().mockResolvedValue({
            items: [{ str: '   ' }],
          }),
        }),
      }),
    });

    await expect(extractTextFromFile(file)).rejects.toThrow('Não encontramos texto nesse arquivo.');
  });

  it('extracts raw text from docx files', async () => {
    const file = binaryFile(
      'docx bytes',
      'curriculo.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    mockExtractRawText.mockResolvedValueOnce({
      value: 'Texto extraído do Word',
    });

    await expect(extractTextFromFile(file)).resolves.toEqual({
      text: 'Texto extraído do Word',
      fileName: 'curriculo.docx',
      source: 'file',
      fileType: 'DOCX',
    });
  });

  it('handles docx parser errors gracefully', async () => {
    const file = binaryFile(
      'corrupted docx',
      'curriculo.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    mockExtractRawText.mockRejectedValueOnce(new Error('Corrupted docx'));

    await expect(extractTextFromFile(file)).rejects.toThrow(
      'Não foi possível ler esse arquivo. Tente outro arquivo ou cole o texto.',
    );
  });
});

describe('extractedTextFromPaste', () => {
  it('creates an extracted text record from pasted text', () => {
    const result = extractedTextFromPaste(
      'Experiência profissional em vendas\r\nCinco anos no varejo',
    );

    expect(result).toEqual({
      text: 'Experiência profissional em vendas\nCinco anos no varejo',
      fileName: 'Texto colado',
      source: 'pasted',
      fileType: 'TXT',
    });
  });

  it('rejects empty or whitespace-only pasted text', () => {
    expect(() => extractedTextFromPaste('   \r\n  ')).toThrow(
      'Não encontramos texto nesse arquivo.',
    );
  });
});
