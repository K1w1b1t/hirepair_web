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
              <svg
                aria-hidden="true"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-4-4 4 4 0 0 1-4-4"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
                <circle cx="8" cy="13" r="1" fill="currentColor" />
                <circle cx="12" cy="17" r="1" fill="currentColor" />
                <circle cx="16" cy="14" r="1" fill="currentColor" />
              </svg>
            </span>
            <div>
              <strong id="analytics-title">Quer ajudar a melhorar sua experiência?</strong>
              <p id="analytics-description">
                Com sua permissão, usamos cookies opcionais para entender o que funciona bem e
                corrigir problemas. Eles não são usados para publicidade, e o Hirepair continua
                funcionando normalmente se você recusar.
              </p>
            </div>
          </div>
          <div className="analytics-consent__actions">
            <a className="analytics-consent__policy" href="/legal#cookies">
              Como usamos cookies
            </a>
            <button
              type="button"
              className="analytics-consent__action analytics-consent__action--decline"
              onClick={() => choose('denied')}
            >
              Agora não
            </button>
            <button
              type="button"
              className="analytics-consent__action analytics-consent__action--accept"
              onClick={() => choose('granted')}
            >
              Aceito
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
