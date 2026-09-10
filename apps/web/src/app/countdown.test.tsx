import { act, render, screen } from '@testing-library/react';
import { Countdown, getCountdownParts } from './countdown';

const launchDate = '2026-10-31T00:00:00-03:00';

describe('getCountdownParts', () => {
  it('splits the remaining interval into days, hours, minutes, and seconds', () => {
    expect(getCountdownParts(launchDate, Date.parse('2026-10-01T00:00:00-03:00'))).toEqual({
      days: 30,
      hours: 0,
      minutes: 0,
      seconds: 0,
      finished: false,
    });
  });

  it('never returns negative values after launch', () => {
    expect(getCountdownParts(launchDate, Date.parse('2026-11-01T00:00:00-03:00'))).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      finished: true,
    });
  });
});

describe('Countdown', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders an accessible countdown and updates every second', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-30T23:59:58-03:00'));

    render(<Countdown deadline={launchDate} initialNow={Date.now()} />);

    expect(screen.getByRole('timer')).toHaveAccessibleName('Contagem regressiva para o lançamento');
    expect(screen.getByText('02', { selector: '[data-unit="segundos"]' })).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1_000);
    });

    expect(screen.getByText('01', { selector: '[data-unit="segundos"]' })).toBeInTheDocument();
  });

  it('announces that launch day has arrived after the deadline', () => {
    render(
      <Countdown deadline={launchDate} initialNow={Date.parse('2026-11-01T00:00:00-03:00')} />,
    );

    expect(screen.getByText('O lançamento chegou.')).toBeInTheDocument();
  });
});
