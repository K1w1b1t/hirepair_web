export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export type ExtractionSource = 'file' | 'pasted';

export interface ExtractedText {
  text: string;
  fileName: string;
  source: ExtractionSource;
  fileType: 'PDF' | 'DOCX' | 'TXT' | 'MD';
  pageCount?: number;
  pages?: Array<{ page: number; start: number; end: number }>;
}

const supportedExtensions = new Map<ExtractedText['fileType'], string[]>([
  ['PDF', ['pdf']],
  ['DOCX', ['docx']],
  ['TXT', ['txt']],
  ['MD', ['md', 'markdown']],
]);

function getFileType(file: File): ExtractedText['fileType'] | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  for (const [type, extensions] of supportedExtensions) {
    if (extension && extensions.includes(extension)) return type;
  }
  return null;
}

function ensureValidFile(file: File): ExtractedText['fileType'] {
  if (file.size > MAX_FILE_SIZE) throw new Error('O arquivo precisa ter no máximo 10 MB.');
  const fileType = getFileType(file);
  if (!fileType) throw new Error('Esse formato ainda não pode ser lido aqui.');
  return fileType;
}

function ensureText(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) throw new Error('Não encontramos texto nesse arquivo.');
  return normalized;
}

async function extractPdf(
  file: File,
): Promise<Pick<ExtractedText, 'text' | 'pageCount' | 'pages'>> {
  const [pdfjs, pdfWorker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker.default;
  const data = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' '),
    );
  }
  const normalized = pages.map((text) => text.replace(/\r\n/g, '\n'));
  const joined = normalized.join('\n');
  const leading = joined.length - joined.trimStart().length;
  let offset = 0;
  return {
    text: joined.trim(),
    pageCount: document.numPages,
    pages: normalized.map((text, i) => {
      const start = Math.max(0, offset - leading);
      offset += text.length + 1;
      return {
        page: i + 1,
        start,
        end: Math.max(start, Math.min(joined.trim().length, offset - 1 - leading)),
      };
    }),
  };
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth/mammoth.browser');
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

async function readPlainText(file: File): Promise<string> {
  return file.text();
}

export async function extractTextFromFile(file: File): Promise<ExtractedText> {
  const fileType = ensureValidFile(file);
  let text: string;
  let pagination: Pick<ExtractedText, 'pageCount' | 'pages'> = {};
  try {
    if (fileType === 'TXT' || fileType === 'MD') text = await readPlainText(file);
    else if (fileType === 'PDF') {
      const extracted = await extractPdf(file);
      text = extracted.text;
      pagination = { pageCount: extracted.pageCount, pages: extracted.pages };
    } else text = await extractDocx(file);
  } catch {
    throw new Error('Não foi possível ler esse arquivo. Tente outro arquivo ou cole o texto.');
  }

  return {
    text: ensureText(text),
    ...pagination,
    fileName: file.name,
    source: 'file',
    fileType,
  };
}

export function extractedTextFromPaste(text: string): ExtractedText {
  return {
    text: ensureText(text),
    fileName: 'Texto colado',
    source: 'pasted',
    fileType: 'TXT',
  };
}
