'use client';
import { useEffect, useRef, useState } from 'react';
import { apiRoot, type GuestChallenge } from '../_lib/guest-api';
interface Widget {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ): string;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: Widget;
  }
}
export function TurnstileChallenge({ onReady }: { onReady: (challenge?: GuestChallenge) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('Verificando acesso seguro…');
  useEffect(() => {
    let active = true;
    let widget: string | undefined;
    let script: HTMLScriptElement | undefined;
    let loaded: (() => void) | undefined;
    const controller = new AbortController();
    const unavailable = () => {
      if (active) {
        onReady();
        setMessage(
          'A verificação de acesso está indisponível. Seus materiais continuam neste aparelho.',
        );
      }
    };
    const initialize = async () => {
      try {
        const response = await fetch(`${apiRoot()}/guest/config`, { signal: controller.signal });
        const config = (await response.json()) as {
          enabled?: boolean;
          siteKey?: string;
          termsVersion?: string;
          privacyVersion?: string;
        };
        if (!active) return;
        if (
          !response.ok ||
          config.enabled !== true ||
          !config.siteKey ||
          !config.termsVersion ||
          !config.privacyVersion
        ) {
          unavailable();
          return;
        }
        loaded = () => {
          if (!active || !container.current || !window.turnstile) {
            unavailable();
            return;
          }
          widget = window.turnstile.render(container.current, {
            sitekey: config.siteKey!,
            action: 'guest_access',
            callback: (token) => {
              if (active) {
                onReady({
                  token,
                  termsVersion: config.termsVersion!,
                  privacyVersion: config.privacyVersion!,
                });
                setMessage('Acesso verificado.');
              }
            },
            'expired-callback': () => {
              if (active) {
                onReady();
                setMessage('Verifique seu acesso novamente.');
              }
            },
            'error-callback': unavailable,
          });
        };
        if (window.turnstile) {
          loaded();
          return;
        }
        script =
          document.querySelector<HTMLScriptElement>('#hirepair-turnstile') ??
          document.createElement('script');
        script.id = 'hirepair-turnstile';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.addEventListener('load', loaded);
        script.addEventListener('error', unavailable);
        if (!script.isConnected) document.head.appendChild(script);
      } catch {
        unavailable();
      }
    };
    void initialize();
    return () => {
      active = false;
      controller.abort();
      if (script && loaded) {
        script.removeEventListener('load', loaded);
        script.removeEventListener('error', unavailable);
      }
      if (widget !== undefined) window.turnstile?.remove(widget);
    };
  }, [onReady]);
  return (
    <div>
      <div aria-label="Verificação de acesso" ref={container} />
      <p role="status">{message}</p>
    </div>
  );
}
