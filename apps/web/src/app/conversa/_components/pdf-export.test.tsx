import { render, screen, waitFor } from '@testing-library/react';
import { PdfExport } from './pdf-export';
import type { ExportArtifact } from '../_lib/pdf-contract';
jest.mock('./pdf-preview', () => ({ PdfPreview: () => <div>PDF real</div> }));
it('downloads the stored blob and revokes the temporary URL', async () => {
  URL.createObjectURL = jest.fn(() => 'blob:pdf');
  URL.revokeObjectURL = jest.fn();
  const artifact = { blob: new Blob(['pdf']), fileName: 'curriculo.pdf' } as ExportArtifact;
  const view = render(<PdfExport artifact={artifact} />);
  await waitFor(() =>
    expect(screen.getByRole('link', { name: 'Baixar PDF' })).toHaveAttribute('href', 'blob:pdf'),
  );
  expect(screen.getByRole('link', { name: 'Baixar PDF' })).toHaveAttribute(
    'download',
    'curriculo.pdf',
  );
  expect(screen.getByRole('link', { name: 'Meus currículos' })).toHaveAttribute(
    'href',
    '/meus-curriculos',
  );
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf');
});
