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

describe('analytics failure isolation and defaults', () => {
  beforeEach(() => {
    setAnalyticsConsent('denied');
    jest.clearAllMocks();
    document.cookie = 'analytics_consent=; Max-Age=0; Path=/';
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'ph_test';
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    delete process.env.NEXT_PUBLIC_APP_ENV;
  });
  it('uses safe development defaults and tolerates URL entries without names', () => {
    setAnalyticsConsent('granted');
    const config = jest.mocked(posthog.init).mock.calls[0][1];
    expect(config?.api_host).toBe('https://us.i.posthog.com');
    expect(config?.session_recording?.maskCapturedNetworkRequestFn?.({} as never)).toEqual({});
    captureAnalyticsEvent('facts_confirmed', { funnel_session_id: 'journey' });
    expect(posthog.capture).toHaveBeenCalledWith(
      'facts_confirmed',
      expect.objectContaining({ environment: 'development' }),
    );
  });
  it('writes Secure consent in production', () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    setAnalyticsConsent('granted');
    expect(posthog.init).toHaveBeenCalled();
  });
  it('isolates initialization and capture failures', () => {
    jest.mocked(posthog.init).mockImplementationOnce(() => {
      throw new Error('init');
    });
    expect(() => setAnalyticsConsent('granted')).not.toThrow();
    expect(captureAnalyticsEvent('resume_generated', { funnel_session_id: 'journey' })).toBe(true);
    expect(posthog.init).toHaveBeenCalledTimes(2);
    setAnalyticsConsent('denied');
    jest.mocked(posthog.init).mockImplementation(() => posthog);
    setAnalyticsConsent('granted');
    jest.mocked(posthog.capture).mockImplementationOnce(() => {
      throw new Error('capture');
    });
    expect(captureAnalyticsEvent('whatsapp_shared', { funnel_session_id: 'journey' })).toBe(false);
  });
  it('isolates every revocation and exception SDK failure', () => {
    setAnalyticsConsent('granted');
    jest.mocked(posthog.stopSessionRecording).mockImplementationOnce(() => {
      throw new Error('stop');
    });
    jest.mocked(posthog.opt_out_capturing).mockImplementationOnce(() => {
      throw new Error('optout');
    });
    jest.mocked(posthog.reset).mockImplementationOnce(() => {
      throw new Error('reset');
    });
    expect(() => setAnalyticsConsent('denied')).not.toThrow();
    setAnalyticsConsent('granted');
    jest.mocked(posthog.captureException).mockImplementationOnce(() => {
      throw new Error('exception');
    });
    expect(() => captureBrowserException(new Error('application'))).not.toThrow();
  });
  it('reads valid decisions and ignores invalid consent cookie values', () => {
    document.cookie = 'analytics_consent=denied; Path=/';
    expect(initializeAnalyticsFromConsent()).toBe('denied');
    document.cookie = 'analytics_consent=granted; Path=/';
    expect(initializeAnalyticsFromConsent()).toBe('granted');
    document.cookie = 'analytics_consent=invalid; Path=/';
    expect(initializeAnalyticsFromConsent()).toBeUndefined();
  });
});
