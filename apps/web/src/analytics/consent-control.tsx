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
    <div className="analytics-consent" aria-label="Preferências de privacidade">
      {decision === undefined || open ? (
        <div
          role="dialog"
          aria-labelledby="analytics-title"
          aria-describedby="analytics-description"
          className="analytics-consent__dialog"
        >
          <strong id="analytics-title">Analytics e reprodução de sessão</strong>
          <p id="analytics-description">
            Com sua permissão, usamos o PostHog para entender o uso e corrigir erros. Textos e
            campos são mascarados. Você pode mudar esta escolha quando quiser.
          </p>
          <div className="analytics-consent__actions">
            <button
              type="button"
              className="button button-primary button-small"
              onClick={() => choose('granted')}
            >
              Aceitar
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
          Preferências de privacidade
        </button>
      )}
    </div>
  );
}
