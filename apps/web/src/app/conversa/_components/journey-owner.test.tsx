import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { JourneyOwner } from './journey-owner';
it('allows browsers without lock support', async () => {
  render(<JourneyOwner>Entrevista</JourneyOwner>);
  expect(await screen.findByText('Entrevista')).toBeInTheDocument();
});
it('transfers the single writer to another tab and releases it on exit', async () => {
  let message!: () => void;
  const close = jest.fn(),
    postMessage = jest.fn();
  class Channel {
    onmessage: () => void = () => {};
    constructor() {
      message = () => this.onmessage();
    }
    close = close;
    postMessage = postMessage;
  }
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: Channel });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: jest.fn(async (_name, _opts, fn) => fn()) },
  });
  const v = render(<JourneyOwner>Entrevista</JourneyOwner>);
  await screen.findByText('Entrevista');
  expect(postMessage).toHaveBeenCalledWith('takeover');
  act(() => message());
  await screen.findByText('Continuar nesta aba');
  fireEvent.click(screen.getByRole('button'));
  v.unmount();
  expect(close).toHaveBeenCalled();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined });
});
it('reports a failed lock acquisition', async () => {
  class Channel {
    onmessage: unknown;
    close() {}
    postMessage() {}
  }
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: Channel });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: jest.fn(async () => {
        throw new Error();
      }),
    },
  });
  const v = render(<JourneyOwner>Entrevista</JourneyOwner>);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Não foi possível'));
  v.unmount();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined });
});
it('falls back when BroadcastChannel is unavailable', async () => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined });
  const v = render(<JourneyOwner>Entrevista</JourneyOwner>);
  await screen.findByText('Entrevista');
  v.unmount();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
});
it('ignores a late grant or rejection after leaving', async () => {
  class Channel {
    onmessage: unknown;
    close() {}
    postMessage() {}
  }
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: Channel });
  let grant!: () => Promise<void>;
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: jest.fn((_name, _opts, fn) => {
        grant = fn;
        return Promise.resolve();
      }),
    },
  });
  const v = render(<JourneyOwner>Entrevista</JourneyOwner>);
  v.unmount();
  await act(async () => grant());
  let reject!: (e: Error) => void;
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: jest.fn(
        () =>
          new Promise((_r, j) => {
            reject = j;
          }),
      ),
    },
  });
  const late = render(<JourneyOwner>Entrevista</JourneyOwner>);
  late.unmount();
  await act(async () => reject(new Error()));
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined });
});
