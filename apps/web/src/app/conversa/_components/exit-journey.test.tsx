import Link from 'next/link';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ExitJourney } from './exit-journey';
import { cleanupJourney } from '../_lib/cleanup-journey';
jest.mock('../_lib/cleanup-journey', () => ({ cleanupJourney: jest.fn() }));
beforeEach(() => {
  window.history.replaceState({}, '', '/conversa');
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
it('opens from the home link and restores focus on cancellation without deleting', () => {
  render(
    <>
      <ExitJourney />
      <Link href="/">Início</Link>
    </>,
  );
  const trigger = screen.getByRole('link');
  expect(screen.queryByRole('button', { name: 'Voltar para home' })).not.toBeInTheDocument();
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar criando' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(cleanupJourney).not.toHaveBeenCalled();
});
it('keeps failed deletion visible and protects an in-flight deletion from Escape', async () => {
  let reject!: (e: Error) => void;
  (cleanupJourney as jest.Mock).mockImplementation(
    () =>
      new Promise((_r, j) => {
        reject = j;
      }),
  );
  window.history.replaceState({}, '', '/conversa?sair=1');
  render(<ExitJourney />);
  fireEvent.click(screen.getByRole('button', { name: 'Sair e descartar' }));
  const dialog = screen.getByRole('dialog');
  const event = new Event('cancel', { cancelable: true });
  dialog.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  await act(async () => reject(new Error()));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível');
  expect(screen.getByRole('button', { name: 'Sair e descartar' })).toBeEnabled();
  const next = new Event('cancel', { cancelable: true });
  dialog.dispatchEvent(next);
  expect(next.defaultPrevented).toBe(false);
});
it('deletes only on explicit confirmation', async () => {
  (cleanupJourney as jest.Mock).mockResolvedValue(undefined);
  render(
    <>
      <ExitJourney />
      <Link href="/">Início</Link>
    </>,
  );
  fireEvent.click(screen.getByRole('link'));
  fireEvent.click(screen.getByRole('button', { name: 'Sair e descartar' }));
  await waitFor(() => expect(cleanupJourney).toHaveBeenCalledWith(true));
});
it('marks a browser back to home and ignores other history destinations', () => {
  const v = render(<ExitJourney />);
  window.history.replaceState({}, '', '/legal');
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(sessionStorage.getItem('hirepair_home_exit_intent')).toBeNull();
  window.history.replaceState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(sessionStorage.getItem('hirepair_home_exit_intent')).toBe('1');
  v.unmount();
  sessionStorage.removeItem('hirepair_home_exit_intent');
});
