import { fireEvent, render, screen } from '@testing-library/react';
import { AnalyticsConsentControl } from './consent-control';
const initialize = jest.fn();
const setConsent = jest.fn();
jest.mock('./analytics', () => ({
  initializeAnalyticsFromConsent: () => initialize(),
  setAnalyticsConsent: (value: string) => setConsent(value),
}));
describe('AnalyticsConsentControl', () => {
  it('uses reassuring copy and provides clear consent choices', () => {
    initialize.mockReturnValue(undefined);
    render(<AnalyticsConsentControl />);
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(setConsent).toHaveBeenCalledWith('denied');
    fireEvent.click(screen.getByRole('button', { name: 'Preferências de cookies' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aceito' }));
    expect(setConsent).toHaveBeenCalledWith('granted');
  });
});
