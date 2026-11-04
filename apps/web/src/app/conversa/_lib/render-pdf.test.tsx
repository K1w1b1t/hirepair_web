import { renderPdf } from './render-pdf';
import { Font, pdf } from '@react-pdf/renderer';
import type { PdfInput } from './pdf-contract';
import type { ReactElement } from 'react';
jest.mock('@react-pdf/renderer', () => ({
  Document: 'document',
  Page: 'page',
  Text: 'text',
  View: 'view',
  Link: 'link',
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn(), getFont: jest.fn() },
  pdf: jest.fn(),
}));
const input: PdfInput = {
  archetype: 'A_FIRST_JOB',
  profile: {
    name: 'Ana São João',
    professionalTitle: 'Atendente',
    email: 'ana@example.com',
    phone: '123',
    confirmed: true,
  },
  document: {
    version: 1,
    explanation: '',
    sections: [
      {
        id: 's',
        title: 'Experiência',
        experienceId: null,
        units: [
          {
            id: 'u',
            text: 'Organização — ação em 2024. https://example.com/cv',
            factIds: [],
            criterionIds: [],
          },
        ],
      },
    ],
  },
};
let pages = 1;
function visit(node: unknown) {
  if (Array.isArray(node)) {
    node.forEach(visit);
    return;
  }
  if (node && typeof node === 'object' && 'props' in node) {
    const props = (
      node as ReactElement<{ children?: unknown; render?: (v: { totalPages: number }) => string }>
    ).props;
    props.render?.({ totalPages: pages });
    visit(props.children);
  }
}
beforeEach(() => {
  pages = 1;
  (Font.getFont as jest.Mock).mockReturnValue({
    load: async () => {},
    data: { hasGlyphForCodePoint: () => true },
  });
  (pdf as jest.Mock).mockImplementation((tree) => ({
    toBlob: async () => {
      visit(tree);
      return { arrayBuffer: async () => new TextEncoder().encode('%PDF-fixture').buffer };
    },
  }));
});
it('renders unchanged text, links and hashes with a versioned layout', async () => {
  const artifact = await renderPdf(input);
  expect(artifact).toMatchObject({
    pageCount: 1,
    mime: 'application/pdf',
    fileName: 'curriculo-Atendente.pdf',
    layoutVersion: 'single-column-v1',
  });
  expect(artifact.fileHash).toHaveLength(64);
  expect(artifact.contentHash).toHaveLength(64);
  const tree = (pdf as jest.Mock).mock.calls.at(-1)[0];
  expect(JSON.stringify(tree)).toContain(
    input.document.sections[0].units[0].text.split(' https')[0],
  );
  expect(JSON.stringify(tree)).toContain('https://example.com/cv');
  const callback = (Font.registerHyphenationCallback as jest.Mock).mock.calls[0][0];
  expect(callback('organização')).toEqual(['organização']);
});
it('supports empty optional fields and a readable fallback name', async () => {
  const profile = { name: '', email: '', phone: '', confirmed: true };
  expect((await renderPdf({ ...input, profile })).fileName).toBe('curriculo-hirepair.pdf');
  expect((await renderPdf({ ...input, profile: { ...profile, name: 'Ana / São' } })).fileName).toBe(
    'curriculo-Ana-São.pdf',
  );
});
it('allows two pages only for applicable archetypes and rejects overflow without truncation', async () => {
  pages = 2;
  expect((await renderPdf({ ...input, archetype: 'E_SPECIALIST' })).pageCount).toBe(2);
  await expect(renderPdf(input)).rejects.toThrow('nenhum conteúdo foi cortado');
});
it('blocks missing glyphs and propagates render failures', async () => {
  (Font.getFont as jest.Mock).mockReturnValue({
    load: async () => {},
    data: { hasGlyphForCodePoint: () => false },
  });
  await expect(renderPdf(input)).rejects.toThrow('caractere');
  (Font.getFont as jest.Mock).mockReturnValue({
    load: async () => {
      throw new Error('font failed');
    },
  });
  await expect(renderPdf(input)).rejects.toThrow('font failed');
});
