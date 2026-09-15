'use client';
import { useEffect } from 'react';
import { captureBrowserException } from '../analytics/analytics';
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureBrowserException(error);
  }, [error]);
  return (
    <html lang="pt-BR">
      <body>
        <main className="section-shell" role="alert">
          <h1 className="section-title">Algo não saiu como esperado</h1>
          <p>Tente novamente. Se o problema continuar, volte mais tarde.</p>
          <button className="button button-primary" type="button" onClick={reset}>
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
