import { act, render, screen } from '@testing-library/react';
import { JourneyResume } from './journey-resume';
import { readProgress } from './conversa/_lib/journey-progress';
import { usePathname } from 'next/navigation';
jest.mock('next/navigation', () => ({ usePathname: jest.fn(() => '/') }));
jest.mock('./conversa/_lib/journey-progress', () => ({ readProgress: jest.fn() }));
it('reports unavailable storage and ignores errors after leaving', async () => {
  (readProgress as jest.Mock).mockRejectedValue(new Error());
  const view = render(<JourneyResume />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível');
  view.unmount();
  let reject!: (v: Error) => void;
  (readProgress as jest.Mock).mockImplementation(
    () =>
      new Promise((_r, j) => {
        reject = j;
      }),
  );
  const late = render(<JourneyResume />);
  late.unmount();
  await act(async () => reject(new Error()));
});
it('keeps home without progress and ignores late results', async () => {
  (readProgress as jest.Mock).mockResolvedValue(null);
  const v = render(<JourneyResume />);
  await act(async () => {});
  v.unmount();
  let resolve!: (v: unknown) => void;
  (readProgress as jest.Mock).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const late = render(<JourneyResume />);
  late.unmount();
  await act(async () => resolve({ phase: 'job' }));
});
it('resumes the persisted phase only from home', async () => {
  (readProgress as jest.Mock).mockResolvedValue({ phase: 'job' });
  const v = render(<JourneyResume />);
  await act(async () => {});
  v.unmount();
  (usePathname as jest.Mock).mockReturnValue('/legal');
  render(<JourneyResume />);
  await act(async () => {});
});
it('opens exit confirmation after a browser back to home', async () => {
  (usePathname as jest.Mock).mockReturnValue('/');
  sessionStorage.setItem('hirepair_home_exit_intent', '1');
  (readProgress as jest.Mock).mockResolvedValue({ phase: 'job' });
  render(<JourneyResume />);
  await act(async () => {});
  expect(sessionStorage.getItem('hirepair_home_exit_intent')).toBeNull();
});
it('rechecks the durable journey when home returns from the browser cache', async () => {
  (usePathname as jest.Mock).mockReturnValue('/');
  (readProgress as jest.Mock).mockResolvedValue({ phase: 'job' });
  Object.defineProperty(performance, 'getEntriesByType', {
    configurable: true,
    value: () => [{ type: 'back_forward' }],
  });
  const v = render(<JourneyResume />);
  await act(async () => {});
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
  await act(async () =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  v.unmount();
  Object.defineProperty(performance, 'getEntriesByType', { configurable: true, value: undefined });
});
