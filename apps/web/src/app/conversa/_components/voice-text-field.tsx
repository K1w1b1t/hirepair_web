'use client';

import { useEffect, useRef, useState } from 'react';

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionConstructor = new () => Recognition;
type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};
type Status = 'idle' | 'starting' | 'listening' | 'stopping';
interface Session {
  recognition: Recognition;
  seen: Set<number>;
  received: boolean;
  timeout?: number;
}

function recognitionConstructor() {
  const browser = window as SpeechWindow;
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

function abort(session: Session) {
  window.clearTimeout(session.timeout);
  try {
    session.recognition.abort();
  } catch {
    // Some browsers throw when the recognition service has already stopped.
  }
}

export interface VoiceTextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly kind: 'input' | 'textarea';
  readonly className: string;
  readonly value: string;
  readonly placeholder: string;
  readonly rows?: number;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly onBusyChange: (busy: boolean) => void;
}

export function VoiceTextField(props: VoiceTextFieldProps) {
  const { id, label, kind, className, value, placeholder, rows, disabled } = props;
  const [supported, setSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [notice, setNotice] = useState('');
  const session = useRef<Session | null>(null);
  const latest = useRef(props);

  useEffect(() => {
    latest.current = props;
  }, [props]);

  useEffect(() => {
    setSupported(Boolean(recognitionConstructor()));
    return () => {
      const active = session.current;
      session.current = null;
      if (active) {
        abort(active);
        latest.current.onBusyChange(false);
      }
    };
  }, []);

  const finish = (active: Session, message: string) => {
    if (session.current !== active) return;
    session.current = null;
    window.clearTimeout(active.timeout);
    setStatus('idle');
    setNotice(message);
    latest.current.onBusyChange(false);
  };

  const cancel = () => {
    const active = session.current;
    if (active) {
      finish(active, '');
      abort(active);
    }
  };

  const toggle = () => {
    const active = session.current;
    if (active) {
      if (status === 'starting') {
        cancel();
        return;
      }
      setStatus('stopping');
      active.timeout = window.setTimeout(() => {
        finish(active, 'Não foi possível concluir o ditado. Você pode continuar digitando.');
        abort(active);
      }, 5000);
      try {
        active.recognition.stop();
      } catch {
        finish(active, 'Não foi possível concluir o ditado. Você pode continuar digitando.');
        abort(active);
      }
      return;
    }

    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setSupported(false);
      return;
    }

    setNotice('');
    try {
      const recognition = new Constructor();
      const next: Session = { recognition, seen: new Set(), received: false };
      session.current = next;
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onstart = () => {
        if (session.current === next) setStatus('listening');
      };
      recognition.onresult = (event) => {
        if (session.current !== next) return;
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (!result.isFinal || next.seen.has(index)) continue;
          next.seen.add(index);
          const text = result[0].transcript.trim();
          if (!text) continue;
          next.received = true;
          const previous = latest.current.value;
          const updated = previous.trim() ? `${previous.trimEnd()} ${text}` : text;
          latest.current = { ...latest.current, value: updated };
          latest.current.onChange(updated);
        }
      };
      recognition.onend = () => {
        finish(next, next.received ? '' : 'Não ouvimos nenhuma fala. Tente de novo ou digite.');
      };
      recognition.onerror = ({ error }) => {
        if (session.current !== next) return;
        const message =
          error === 'not-allowed' || error === 'service-not-allowed'
            ? 'O microfone não foi autorizado. Permita o acesso no navegador ou digite.'
            : error === 'no-speech'
              ? 'Não ouvimos nenhuma fala. Tente de novo ou digite.'
              : 'Não foi possível usar o ditado. Você pode continuar digitando.';
        finish(next, message);
        abort(next);
      };
      setStatus('starting');
      latest.current.onBusyChange(true);
      recognition.start();
    } catch {
      cancel();
      setNotice('Não foi possível iniciar o ditado. Você pode continuar digitando.');
    }
  };

  const busy = status !== 'idle';
  const fieldProps = {
    'aria-label': label,
    'aria-describedby': `${id}-voice-notice ${id}-voice-privacy`,
    className,
    id,
    value,
    placeholder,
    disabled,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      cancel();
      setNotice('');
      latest.current.onChange(event.target.value);
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    },
  };
  const statusText = {
    idle: notice,
    starting: 'Aguardando microfone…',
    listening: 'Ouvindo…',
    stopping: 'Finalizando ditado…',
  }[status];

  return (
    <div className="voice-text-field">
      <div className="voice-input-shell">
        {kind === 'textarea' ? <textarea {...fieldProps} rows={rows} /> : <input {...fieldProps} />}
        <button
          aria-controls={id}
          aria-describedby={`${id}-voice-notice ${id}-voice-privacy`}
          aria-label={busy ? 'Parar ditado' : 'Falar para preencher'}
          aria-pressed={busy}
          className="voice-input-button"
          disabled={(disabled && !busy) || supported !== true || status === 'stopping'}
          onClick={toggle}
          onKeyDown={fieldProps.onKeyDown}
          title={`Ditado: ${label}`}
          type="button"
        >
          <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
            {busy ? (
              <rect fill="currentColor" height="12" rx="2" width="12" x="6" y="6" />
            ) : (
              <>
                <path
                  d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 1 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
                <path
                  d="M18.5 11.5a6.5 6.5 0 0 1-13 0M12 18v3M9 21h6"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </>
            )}
          </svg>
        </button>
      </div>
      <p aria-live="polite" className="voice-input-notice" id={`${id}-voice-notice`} role="status">
        {supported === false
          ? 'Ditado indisponível neste navegador. Você pode digitar.'
          : statusText}
      </p>
      <p className="voice-input-privacy" id={`${id}-voice-privacy`}>
        Ao falar, o áudio pode ser processado pelo serviço do seu navegador. Revise o texto.
      </p>
    </div>
  );
}
