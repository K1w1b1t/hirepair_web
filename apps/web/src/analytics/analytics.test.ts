jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    capture: jest.fn(),
    captureException: jest.fn(),
    init: jest.fn(),
    opt_out_capturing: jest.fn(),
    register: jest.fn(),
    reset: jest.fn(),
    stopSessionRecording: jest.fn(),
  },
}));
import posthog from 'posthog-js';
import {
  captureAnalyticsEvent,
  captureBrowserException,
  initializeAnalyticsFromConsent,
  setAnalyticsConsent,
} from './analytics';
describe('analytics', () => {
  beforeEach(() => {
    setAnalyticsConsent('denied');
    jest.clearAllMocks();
    document.cookie = 'analytics_consent=; Max-Age=0; Path=/';
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'ph_test';
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://us.i.posthog.com';
    process.env.NEXT_PUBLIC_APP_ENV = 'staging';
  });
  it('does not initialize or capture without explicit consent', () => {
    initializeAnalyticsFromConsent();
    captureAnalyticsEvent('session_started', { funnel_session_id: 'session-1' });
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });
  it('initializes private telemetry after consent and adds fixed properties', () => {
    setAnalyticsConsent('granted');
    captureAnalyticsEvent('session_started', { funnel_session_id: 'session-1' });
    expect(posthog.init).toHaveBeenCalledWith(
      'ph_test',
      expect.objectContaining({
        api_host: 'https://us.i.posthog.com',
        autocapture: true,
        capture_exceptions: true,
        capture_pageview: 'history_change',
        loaded: expect.any(Function),
        sanitize_properties: expect.any(Function),
        session_recording: expect.objectContaining({
          maskAllInputs: true,
          maskTextSelector: '*',
          recordHeaders: false,
          recordBody: false,
        }),
      }),
    );
    const loaded = jest.mocked(posthog.init).mock.calls[0][1]?.loaded;
    loaded?.(posthog);
    expect(posthog.register).toHaveBeenCalledWith({
      app: 'hirepair',
      environment: 'staging',
      telemetry_source: 'browser',
    });
    expect(posthog.capture).toHaveBeenCalledWith('session_started', {
      app: 'hirepair',
      environment: 'staging',
      telemetry_source: 'browser',
      funnel_session_id: 'session-1',
    });
    expect(document.cookie).toContain('analytics_consent=granted');
  });
  it('strips query strings in replay URLs', () => {
    setAnalyticsConsent('granted');
    const sanitize = jest.mocked(posthog.init).mock.calls[0][1]?.session_recording
      ?.maskCapturedNetworkRequestFn;
    expect(sanitize?.({ name: 'https://hirepair.com.br/conversa?token=secret' } as never)).toEqual({
      name: 'https://hirepair.com.br/conversa',
    });
  });
  it('revokes capture and remains fail-open if the SDK fails', () => {
    setAnalyticsConsent('granted');
    jest.mocked(posthog.opt_out_capturing).mockImplementation(() => {
      throw new Error('sdk unavailable');
    });
    expect(() => setAnalyticsConsent('denied')).not.toThrow();
    expect(posthog.stopSessionRecording).toHaveBeenCalled();
    expect(posthog.reset).toHaveBeenCalled();
  });
  it('captures exceptions only after consent and no-ops without a token', () => {
    captureBrowserException(new Error('before'));
    expect(posthog.captureException).not.toHaveBeenCalled();
    setAnalyticsConsent('granted');
    captureBrowserException(new Error('after'));
    expect(posthog.captureException).toHaveBeenCalled();
    setAnalyticsConsent('denied');
    jest.clearAllMocks();
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    document.cookie = 'analytics_consent=; Max-Age=0; Path=/';
    setAnalyticsConsent('granted');
    captureAnalyticsEvent('session_started', { funnel_session_id: 'x' });
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });
  it('remains usable after an initialization failure and retries after a later explicit opt-in', () => {
    jest.mocked(posthog.init).mockImplementationOnce(() => {
      throw new Error('sdk unavailable');
    });
    setAnalyticsConsent('granted');
    expect(posthog.init).toHaveBeenCalledTimes(1);
    setAnalyticsConsent('granted');
    expect(captureAnalyticsEvent('interview_completed', { funnel_session_id: 'synthetic' })).toBe(
      true,
    );
  });
  it('restores explicit cookie consent and configures secure production events without URL values', () => {
    document.cookie = 'analytics_consent=granted; Path=/';
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    expect(initializeAnalyticsFromConsent()).toBe('granted');
    const options = jest.mocked(posthog.init).mock.calls[0][1];
    expect(options?.sanitize_properties?.({}, 'interview_completed')).toEqual({});
    setAnalyticsConsent('granted');
    expect(captureAnalyticsEvent('interview_completed', { funnel_session_id: 'synthetic' })).toBe(
      true,
    );
  });
  it('uses default host and environment, handles unnamed requests and rejects failed event delivery', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    delete process.env.NEXT_PUBLIC_APP_ENV;
    setAnalyticsConsent('granted');
    const options = jest.mocked(posthog.init).mock.calls[0][1];
    expect(options?.api_host).toBe('https://us.i.posthog.com');
    expect(options?.session_recording?.maskCapturedNetworkRequestFn?.({} as never)).toEqual({});
    jest.mocked(posthog.capture).mockImplementationOnce(() => {
      throw new Error('offline');
    });
    expect(captureAnalyticsEvent('interview_completed', { funnel_session_id: 'synthetic' })).toBe(
      false,
    );
  });
});
