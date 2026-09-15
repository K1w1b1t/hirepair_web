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
import { setAnalyticsConsent } from './analytics';
describe('automatic URL sanitization', () => {
  it('removes query strings before automatic properties leave the browser', () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'ph_test';
    setAnalyticsConsent('denied');
    jest.clearAllMocks();
    setAnalyticsConsent('granted');
    const sanitize = jest.mocked(posthog.init).mock.calls[0][1]?.sanitize_properties;
    expect(
      sanitize?.(
        {
          $current_url: 'https://site/conversa?token=x',
          $referrer: 'https://search/?q=name',
          $prev_pageview_pathname: '/?email=x',
          safe: 1,
        },
        'event',
      ),
    ).toEqual({
      $current_url: 'https://site/conversa',
      $referrer: 'https://search/',
      $prev_pageview_pathname: '/',
      safe: 1,
    });
  });
});
