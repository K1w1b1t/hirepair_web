'use client';
import { useEffect, useRef, useState } from 'react';
import { cleanupJourney } from '../_lib/cleanup-journey';
export function ExitJourney() {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const open = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest('a');
      if (anchor?.getAttribute('href') === '/') {
        e.preventDefault();
        dialog.current?.showModal();
      }
    };
    const historyExit = () => {
      if (location.pathname === '/') sessionStorage.setItem('hirepair_home_exit_intent', '1');
    };
    window.addEventListener('popstate', historyExit);
    document.addEventListener('click', open);
    if (new URLSearchParams(location.search).get('sair') === '1') dialog.current?.showModal();
    return () => {
      document.removeEventListener('click', open);
      window.removeEventListener('popstate', historyExit);
    };
  }, []);
  async function discard() {
    setBusy(true);
    setError('');
    try {
      await cleanupJourney(true);
      window.location.assign('/');
    } catch {
      setError('Não foi possível apagar o progresso. Tente novamente.');
      setBusy(false);
    }
  }
  return (
    <div className="journey-exit">
      <button
        ref={trigger}
        className="button button-outline"
        onClick={() => dialog.current?.showModal()}
      >
        Voltar para home
      </button>
      <dialog
        className="exit-dialog"
        ref={dialog}
        aria-labelledby="exit-title"
        onClose={() => trigger.current?.focus()}
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <h2 id="exit-title">Sair da criação do currículo?</h2>
        <p>
          Seu progresso não será salvo. Ao sair, o progresso deste currículo será apagado. Seus
          currículos já aprovados continuarão salvos.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="exit-actions">
          <button
            autoFocus
            className="button button-primary"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            Continuar criando
          </button>
          <button className="button button-outline" disabled={busy} onClick={() => void discard()}>
            {busy ? 'Apagando progresso…' : 'Sair e descartar'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
