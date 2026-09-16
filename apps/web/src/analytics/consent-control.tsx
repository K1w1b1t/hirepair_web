'use client';
import { useEffect, useState } from 'react';
import {
  type AnalyticsConsent,
  initializeAnalyticsFromConsent,
  setAnalyticsConsent,
} from './analytics';
export function AnalyticsConsentControl() {
  const [decision, setDecision] = useState<AnalyticsConsent>();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setDecision(initializeAnalyticsFromConsent());
  }, []);
  const choose = (value: AnalyticsConsent) => {
    setAnalyticsConsent(value);
    setDecision(value);
    setOpen(false);
  };
  return (
    <div className="analytics-consent" aria-label="Preferências de cookies">
      {decision === undefined || open ? (
        <div
          role="dialog"
          aria-labelledby="analytics-title"
          aria-describedby="analytics-description"
          className="analytics-consent__dialog"
        >
          <strong id="analytics-title">Cookies opcionais</strong>
          <p id="analytics-description">
            Usamos cookies opcionais para entender o que funciona no site e corrigir problemas. Você
            pode aceitar ou recusar; os recursos essenciais continuam funcionando.
          </p>
          <a className="analytics-consent__policy" href="/legal#cookies">
            Leia nossa Política de Cookies
          </a>
          <div className="analytics-consent__actions">
            <button
              type="button"
              className="button button-primary button-small"
              onClick={() => choose('granted')}
            >
              Aceitar cookies
            </button>
            <button
              type="button"
              className="button button-outline button-small"
              onClick={() => choose('denied')}
            >
              Recusar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="analytics-consent__preferences"
          onClick={() => setOpen(true)}
        >
          Preferências de cookies
        </button>
      )}
    </div>
  );
}
