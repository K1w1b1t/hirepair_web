'use client';
import { useEffect } from 'react';
import { captureAnalyticsEvent } from './analytics';
const SESSION_ID_KEY = 'hirepair_funnel_session_id';
const CAPTURED_KEY = 'hirepair_session_started_captured';
export function ConversationAnalytics() {
  useEffect(() => {
    const capture = () => {
      const id = sessionStorage.getItem(SESSION_ID_KEY) ?? crypto.randomUUID();
      sessionStorage.setItem(SESSION_ID_KEY, id);
      if (sessionStorage.getItem(CAPTURED_KEY)) return;
      if (captureAnalyticsEvent('session_started', { funnel_session_id: id })) {
        sessionStorage.setItem(CAPTURED_KEY, 'true');
      }
    };
    capture();
    window.addEventListener('analytics-consent-granted', capture);
    return () => window.removeEventListener('analytics-consent-granted', capture);
  }, []);
  return null;
}
