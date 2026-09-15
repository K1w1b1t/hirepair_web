jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    capture: jest.fn(),
    captureException: jest.fn(),
    init: jest.fn(),
    opt_out_capturing: jest.fn(),
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
        capture_pageview: true,
        sanitize_properties: expect.any(Function),
        session_recording: expect.objectContaining({
          maskAllInputs: true,
          maskTextSelector: '*',
          recordHeaders: false,
          recordBody: false,
        }),
      }),
    );
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
});
