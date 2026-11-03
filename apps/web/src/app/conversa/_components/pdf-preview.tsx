'use client';
import { useEffect, useRef, useState } from 'react';
export function PdfPreview({ blob }: { blob: Blob }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    let dispose: (() => void) | undefined;
    void (async () => {
      const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.mjs?url'),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const data = await blob.arrayBuffer();
      if (!live) return;
      const task = pdfjs.getDocument({ data });
      dispose = () => {
        void task.destroy();
      };
      const doc = await task.promise;
      if (!live) return;
      container.current!.replaceChildren();
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        if (!live) return;
        const canvas = document.createElement('canvas');
        const viewport = page.getViewport({ scale: 1.3 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute(
          'aria-label',
          `Página ${n} de ${doc.numPages}. Conteúdo disponível na versão textual abaixo.`,
        );
        container.current!.append(canvas);
        await page.render({ canvas, viewport }).promise;
        canvas.dataset.rendered = 'true';
      }
    })().catch(() => {
      if (live) setError('Não foi possível mostrar as páginas. Tente abrir a prévia novamente.');
    });
    return () => {
      live = false;
      dispose?.();
    };
  }, [blob]);
  return (
    <>
      <div className="pdf-pages" ref={container} aria-label="Páginas do PDF" />
      {error && <p role="alert">{error}</p>}
    </>
  );
}
