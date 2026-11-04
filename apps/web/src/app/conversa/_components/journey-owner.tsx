'use client';
import { useEffect, useState, type ReactNode } from 'react';
export function JourneyOwner({ children }: { children: ReactNode }) {
  const [owned, setOwned] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (!navigator.locks || typeof BroadcastChannel === 'undefined') {
      setOwned(true);
      return;
    }
    let live = true,
      release: (() => void) | undefined;
    const channel = new BroadcastChannel('hirepair-journey-owner');
    channel.onmessage = () => {
      setOwned(false);
      release?.();
    };
    const controller = new AbortController();
    channel.postMessage('takeover');
    void navigator.locks
      .request('hirepair-active-journey', { signal: controller.signal }, async () => {
        if (!live) return;
        setOwned(true);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      })
      .catch(() => {
        if (live)
          setError('Não foi possível abrir a jornada nesta aba. Recarregue para tentar novamente.');
      });
    return () => {
      live = false;
      controller.abort();
      release?.();
      channel.close();
    };
  }, []);
  return owned ? (
    children
  ) : (
    <main className="resume-library">
      <h1>Sua jornada está salva</h1>
      <p role="status">{error || 'A jornada foi aberta em outra aba ou está sendo retomada.'}</p>
      <button className="button button-primary" onClick={() => location.reload()}>
        Continuar nesta aba
      </button>
    </main>
  );
}
