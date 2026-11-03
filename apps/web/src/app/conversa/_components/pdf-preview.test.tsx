import { act, render, screen, waitFor } from '@testing-library/react';
import { PdfPreview } from './pdf-preview';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: {},
  getDocument: jest.fn(),
}));
jest.mock('pdfjs-dist/legacy/build/pdf.worker.mjs?url', () => ({ default: '/worker.js' }));
const destroy = jest.fn(async () => {}),
  pageRender = jest.fn(() => ({ promise: Promise.resolve() }));
const blob = { arrayBuffer: async () => new ArrayBuffer(1) } as Blob;
function task(pages = 1) {
  return {
    promise: Promise.resolve({
      numPages: pages,
      getPage: async () => ({
        getViewport: () => ({ width: 100, height: 200 }),
        render: pageRender,
      }),
    }),
    destroy,
  };
}
it('renders the stored bytes and destroys the worker on exit', async () => {
  (getDocument as jest.Mock).mockReturnValue(task(2));
  const v = render(<PdfPreview blob={blob} />);
  await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2));
  expect(pageRender).toHaveBeenCalledTimes(2);
  v.unmount();
  expect(destroy).toHaveBeenCalled();
});
it('reports parser failures', async () => {
  (getDocument as jest.Mock).mockImplementation(() => {
    throw new Error();
  });
  render(<PdfPreview blob={blob} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível');
});
it('ignores work completed after unmount', async () => {
  let resolve!: (v: unknown) => void;
  (getDocument as jest.Mock).mockReturnValue({
    promise: new Promise((r) => {
      resolve = r;
    }),
    destroy,
  });
  const v = render(<PdfPreview blob={blob} />);
  await waitFor(() => expect(getDocument).toHaveBeenCalled());
  v.unmount();
  await act(async () => resolve({ numPages: 1 }));
});
it('stops before rendering a page when it arrives after exit', async () => {
  let resolve!: (v: unknown) => void;
  (getDocument as jest.Mock).mockReturnValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: () =>
        new Promise((r) => {
          resolve = r;
        }),
    }),
    destroy,
  });
  const view = render(<PdfPreview blob={blob} />);
  await waitFor(() => expect(resolve).toBeDefined());
  view.unmount();
  await act(async () => resolve({}));
});
it('ignores parser errors after exit', async () => {
  let reject!: (v: Error) => void;
  (getDocument as jest.Mock).mockReturnValue({
    promise: new Promise((_r, j) => {
      reject = j;
    }),
    destroy,
  });
  const view = render(<PdfPreview blob={blob} />);
  await act(async () => {});
  view.unmount();
  await act(async () => reject(new Error()));
});
it('does not start a worker if the bytes arrive after unmount', async () => {
  let resolve!: (v: ArrayBuffer) => void;
  const delayed = {
    arrayBuffer: () =>
      new Promise<ArrayBuffer>((r) => {
        resolve = r;
      }),
  } as Blob;
  const view = render(<PdfPreview blob={delayed} />);
  await waitFor(() => expect(resolve).toBeDefined());
  view.unmount();
  await act(async () => resolve(new ArrayBuffer(1)));
});
