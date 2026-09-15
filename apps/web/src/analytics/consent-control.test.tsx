import { fireEvent, render, screen } from '@testing-library/react';
import { AnalyticsConsentControl } from './consent-control';
const initialize = jest.fn();
const setConsent = jest.fn();
jest.mock('./analytics', () => ({
  initializeAnalyticsFromConsent: () => initialize(),
  setAnalyticsConsent: (value: string) => setConsent(value),
}));
describe('AnalyticsConsentControl', () => {
  it('offers equivalent accept and deny actions and a permanent preferences control', () => {
    initialize.mockReturnValue(undefined);
    render(<AnalyticsConsentControl />);
    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));
    expect(setConsent).toHaveBeenCalledWith('denied');
    fireEvent.click(screen.getByRole('button', { name: 'Preferências de privacidade' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }));
    expect(setConsent).toHaveBeenCalledWith('granted');
  });
});
