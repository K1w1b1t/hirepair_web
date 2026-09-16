import { fireEvent, render, screen } from '@testing-library/react';
import GlobalError from './global-error';
const capture = jest.fn();
jest.mock('../analytics/analytics', () => ({
  captureBrowserException: (error: unknown) => capture(error),
}));
describe('GlobalError', () => {
  it('captures the error and offers an accessible recovery action', () => {
    const reset = jest.fn();
    const error = new Error('controlled');
    render(<GlobalError error={error} reset={reset} />);
    expect(capture).toHaveBeenCalledWith(error);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(reset).toHaveBeenCalled();
  });
});
