'use client';

import posthog from 'posthog-js';

export type AnalyticsConsent = 'granted' | 'denied';
export type FunnelEvent =
  'session_started' | 'facts_confirmed' | 'resume_generated' | 'whatsapp_shared';
type FunnelProperties = { funnel_session_id: string };

const COOKIE_NAME = 'analytics_consent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
let initialized = false;
let consent: AnalyticsConsent | undefined;

function environment(): 'development' | 'staging' | 'production' {
  const value = process.env.NEXT_PUBLIC_APP_ENV;
  return value === 'staging' || value === 'production' ? value : 'development';
}

function fixedProperties() {
  return { app: 'hirepair', environment: environment(), telemetry_source: 'browser' } as const;
}

function readConsent(): AnalyticsConsent | undefined {
  const value = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${COOKIE_NAME}=`))
    ?.split('=')[1];
  return value === 'granted' || value === 'denied' ? value : undefined;
}

function initialize(): void {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (initialized || consent !== 'granted' || !token) return;
  try {
    posthog.init(token, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      autocapture: true,
      capture_exceptions: true,
      capture_pageview: 'history_change',
      loaded: (client) => {
        client.register(fixedProperties());
      },
      sanitize_properties: (properties) => {
        for (const key of ['$current_url', '$referrer', '$prev_pageview_pathname']) {
          const value = properties[key];
          if (typeof value === 'string') properties[key] = value.split('?')[0];
        }
        return properties;
      },
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '*',
        recordHeaders: false,
        recordBody: false,
        maskCapturedNetworkRequestFn: (request) => {
          if (request.name) request.name = request.name.split('?')[0];
          return request;
        },
      },
    });
    initialized = true;
  } catch {
    initialized = false;
  }
}

export function initializeAnalyticsFromConsent(): AnalyticsConsent | undefined {
  consent = readConsent();
  initialize();
  return consent;
}

export function setAnalyticsConsent(decision: AnalyticsConsent): void {
  consent = decision;
  document.cookie = `${COOKIE_NAME}=${decision}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${environment() === 'production' ? '; Secure' : ''}`;
  if (decision === 'granted') {
    initialize();
    window.dispatchEvent(new Event('analytics-consent-granted'));
    return;
  }
  try {
    posthog.stopSessionRecording();
  } catch {}
  try {
    posthog.opt_out_capturing();
  } catch {}
  try {
    posthog.reset();
  } catch {}
  initialized = false;
}

export function captureAnalyticsEvent(event: FunnelEvent, properties: FunnelProperties): boolean {
  if (consent !== 'granted') consent = readConsent();
  initialize();
  if (!initialized) return false;
  try {
    posthog.capture(event, { ...fixedProperties(), ...properties });
    return true;
  } catch {
    return false;
  }
}

export function captureBrowserException(error: unknown): void {
  if (consent !== 'granted') consent = readConsent();
  initialize();
  if (!initialized) return;
  try {
    posthog.captureException(error, fixedProperties());
  } catch {}
}
