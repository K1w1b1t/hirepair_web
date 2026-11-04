import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TurnstileChallenge } from './turnstile-challenge';
const config = { enabled: true, siteKey: 'site', termsVersion: 'terms', privacyVersion: 'privacy' };
type Options = Parameters<NonNullable<Window['turnstile']>['render']>[1];
describe('Turnstile access widget', () => {
  let options: Options;
  const onReady = jest.fn();
  const remove = jest.fn();
  const widget = jest.fn((container: HTMLElement, supplied: Options) => {
    options = supplied;
    return 'widget';
  });
  beforeEach(() => {
    jest.clearAllMocks();
    document.querySelector('#hirepair-turnstile')?.remove();
    delete window.turnstile;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(config) }),
    });
  });
  afterEach(() => {
    delete window.turnstile;
    document.querySelector('#hirepair-turnstile')?.remove();
  });
  it('renders an existing widget, handles verification, expiry, error and cleanup', async () => {
    window.turnstile = { render: widget, remove };
    const view = render(<TurnstileChallenge onReady={onReady} />);
    await waitFor(() => expect(widget).toHaveBeenCalledTimes(1));
    expect(options.action).toBe('guest_access');
    act(() => options.callback('proof'));
    expect(onReady).toHaveBeenLastCalledWith({
      token: 'proof',
      termsVersion: 'terms',
      privacyVersion: 'privacy',
    });
    expect(screen.getByRole('status')).toHaveTextContent('Acesso verificado.');
    act(() => options['expired-callback']());
    expect(screen.getByRole('status')).toHaveTextContent('Verifique seu acesso novamente.');
    act(() => options['error-callback']());
    expect(onReady).toHaveBeenLastCalledWith();
    view.unmount();
    expect(remove).toHaveBeenCalledWith('widget');
    act(() => {
      options.callback('late');
      options['expired-callback']();
      options['error-callback']();
    });
    expect(onReady).toHaveBeenCalledTimes(3);
  });
  it.each([
    { ...config, enabled: false },
    { ...config, siteKey: '' },
    { ...config, termsVersion: '' },
    { ...config, privacyVersion: '' },
  ])('fails closed on unavailable configuration %j', async (data) => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });
    render(<TurnstileChallenge onReady={onReady} />);
    await screen.findByText(/indisponível/);
    expect(widget).not.toHaveBeenCalled();
  });
  it('handles HTTP and network failures', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false, json: () => Promise.resolve(config) });
    const view = render(<TurnstileChallenge onReady={onReady} />);
    await screen.findByText(/indisponível/);
    expect(onReady).toHaveBeenLastCalledWith();
    view.unmount();
    (fetch as jest.Mock).mockRejectedValue(new Error('network'));
    render(<TurnstileChallenge onReady={onReady} />);
    await screen.findByText(/indisponível/);
    expect(onReady).toHaveBeenLastCalledWith();
  });
  it('loads the script once and renders when it becomes available', async () => {
    const view = render(<TurnstileChallenge onReady={onReady} />);
    await waitFor(() => expect(document.querySelector('#hirepair-turnstile')).not.toBeNull());
    const script = document.querySelector('#hirepair-turnstile')!;
    window.turnstile = { render: widget, remove };
    fireEvent.load(script);
    expect(widget).toHaveBeenCalledTimes(1);
    view.unmount();
    fireEvent.load(script);
    expect(widget).toHaveBeenCalledTimes(1);
  });
  it('reuses an existing script and handles script errors or missing widget', async () => {
    const script = document.createElement('script');
    script.id = 'hirepair-turnstile';
    document.head.appendChild(script);
    render(<TurnstileChallenge onReady={onReady} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.load(script);
    await screen.findByText(/indisponível/);
    fireEvent.error(script);
    expect(onReady).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('#hirepair-turnstile')).toHaveLength(1);
  });
  it('ignores a configuration response after unmount', async () => {
    let resolve!: (value: unknown) => void;
    (fetch as jest.Mock).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const view = render(<TurnstileChallenge onReady={onReady} />);
    view.unmount();
    await act(async () => {
      resolve({ ok: true, json: () => Promise.resolve(config) });
    });
    expect(onReady).not.toHaveBeenCalled();
    expect(widget).not.toHaveBeenCalled();
  });
});
