import { render } from '@testing-library/react';
import { ConversationAnalytics } from './conversation-analytics';
const capture = jest.fn();
jest.mock('./analytics', () => ({
  captureAnalyticsEvent: (...args: unknown[]) => capture(...args),
}));
describe('ConversationAnalytics', () => {
  beforeEach(() => {
    capture.mockReset();
    capture.mockReturnValue(true);
    sessionStorage.clear();
  });
  it('captures session_started once per browser journey using one stored id', () => {
    const { unmount } = render(<ConversationAnalytics />);
    const firstId = sessionStorage.getItem('hirepair_funnel_session_id');
    unmount();
    render(<ConversationAnalytics />);
    expect(firstId).toBeTruthy();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('session_started', { funnel_session_id: firstId });
  });
  it('waits for consent before marking the event as captured', () => {
    capture.mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<ConversationAnalytics />);
    expect(sessionStorage.getItem('hirepair_session_started_captured')).toBeNull();
    window.dispatchEvent(new Event('analytics-consent-granted'));
    expect(capture).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem('hirepair_session_started_captured')).toBe('true');
  });
});
it('preserves the active local engine funnel across a new browser tab', () => {
  localStorage.setItem('hirepair_engine_funnel', 'persisted-funnel');
  sessionStorage.clear();
  sessionStorage.setItem('hirepair_funnel_session_id', 'other-tab');
  capture.mockReturnValue(true);
  render(<ConversationAnalytics />);
  expect(sessionStorage.getItem('hirepair_funnel_session_id')).toBe('persisted-funnel');
  expect(capture).toHaveBeenLastCalledWith('session_started', {
    funnel_session_id: 'persisted-funnel',
  });
  localStorage.removeItem('hirepair_engine_funnel');
});
