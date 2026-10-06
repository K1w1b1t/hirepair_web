import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { AnalyticsConsentControl } from './consent-control';
const initialize = jest.fn();
const setConsent = jest.fn();
jest.mock('./analytics', () => ({
  initializeAnalyticsFromConsent: () => initialize(),
  setAnalyticsConsent: (value: string) => setConsent(value),
}));
describe('AnalyticsConsentControl', () => {
  it('does not render a consent dialog before reading the saved decision', () => {
    expect(renderToString(<AnalyticsConsentControl />)).not.toContain('role="dialog"');
  });

  it.each(['denied', 'granted'])('keeps the dialog closed after restoring %s', (decision) => {
    initialize.mockReturnValue(decision);
    render(<AnalyticsConsentControl />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preferências de cookies' })).toBeInTheDocument();
  });
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
