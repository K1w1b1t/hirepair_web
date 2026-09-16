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
          <div className="analytics-consent__content">
            <span className="analytics-consent__icon" aria-hidden="true">
              🍪
            </span>
            <div>
              <strong id="analytics-title">Quer ajudar a melhorar sua experiência?</strong>
              <p id="analytics-description">
                Com sua permissão, usamos cookies opcionais para entender o que funciona bem e
                corrigir problemas. Eles não são usados para publicidade, e o Hirepair continua
                funcionando normalmente se você recusar.
              </p>
              <a className="analytics-consent__policy" href="/legal#cookies">
                Como usamos cookies
              </a>
            </div>
          </div>
          <div className="analytics-consent__actions">
            <button
              type="button"
              className="analytics-consent__action analytics-consent__action--accept"
              onClick={() => choose('granted')}
            >
              Sim, quero ajudar
            </button>
            <button
              type="button"
              className="analytics-consent__action analytics-consent__action--decline"
              onClick={() => choose('denied')}
            >
              Agora não
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
