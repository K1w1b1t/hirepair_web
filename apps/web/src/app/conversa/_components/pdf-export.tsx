'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ExportArtifact } from '../_lib/pdf-contract';
import { PdfPreview } from './pdf-preview';
export function PdfExport({ artifact }: { artifact: ExportArtifact }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const value = URL.createObjectURL(artifact.blob);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [artifact]);
  return (
    <>
      <div className="resume-actions">
        <a className="button button-primary" href={url || undefined} download={artifact.fileName}>
          Baixar PDF
        </a>
        <Link className="button button-outline" href="/meus-curriculos">
          Meus currículos
        </Link>
        <Link className="button button-outline" href="/">
          Voltar para home
        </Link>
      </div>
      <PdfPreview blob={artifact.blob} />
    </>
  );
}
