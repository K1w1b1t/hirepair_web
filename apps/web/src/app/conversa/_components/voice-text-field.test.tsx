import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  installSpeechRecognition,
  MockSpeechRecognition,
} from '../../../../test/mock-speech-recognition';
import { VoiceTextField, type VoiceTextFieldProps } from './voice-text-field';

function renderField(overrides: Partial<VoiceTextFieldProps> = {}) {
  const props: VoiceTextFieldProps = {
    id: 'experience',
    label: 'Experiência',
    kind: 'textarea',
    className: 'test-field',
    value: '',
    placeholder: 'Conte sua experiência',
    rows: 5,
    disabled: false,
    onChange: jest.fn(),
    onBusyChange: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<VoiceTextField {...props} />) };
}

function start() {
  fireEvent.click(screen.getByRole('button', { name: 'Falar para preencher' }));
  return MockSpeechRecognition.instances.at(-1)!;
}

describe('VoiceTextField', () => {
  let restore: () => void;
  beforeEach(() => {
    restore = installSpeechRecognition();
  });
  afterEach(() => {
    restore();
    jest.useRealTimers();
  });

  it('requests speech only after a click and invites the user to speak without extra privacy copy', () => {
    const { props } = renderField();
    expect(MockSpeechRecognition.instances).toHaveLength(0);
    expect(screen.getByLabelText('Experiência')).toHaveAttribute(
      'aria-describedby',
      'experience-voice-notice',
    );
    expect(screen.queryByText(/áudio pode ser processado/i)).not.toBeInTheDocument();
    const recognition = start();
    expect(recognition.start).toHaveBeenCalledTimes(1);
    expect(recognition).toMatchObject({ lang: 'pt-BR', continuous: true, interimResults: true });
    expect(props.onBusyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('status')).toHaveTextContent('Preparando o microfone…');
    act(() => recognition.onstart?.());
    expect(screen.getByRole('status')).toHaveTextContent('Pode falar.');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ditado: Experiência')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Parar ditado' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('aria-controls', 'experience-voice-transcript');
    expect(button.querySelector('rect')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows interim speech in a card and fills the field only when dictation ends', () => {
    const { props } = renderField({ value: 'Experiência anterior.  ' });
    const recognition = start();
    act(() => recognition.onstart?.());
    act(() => recognition.result(['provisório'], 0, false));
    expect(props.onChange).not.toHaveBeenCalled();
    expect(screen.getByText('provisório')).toBeInTheDocument();
    act(() => recognition.result([' Atendimento. ', ' Vendas. ']));
    expect(props.onChange).not.toHaveBeenCalled();
    act(() => recognition.result(['Atendimento.', 'Vendas.', '   ']));
    expect(props.onChange).not.toHaveBeenCalled();
    act(() => recognition.result(['Atendimento.', 'Vendas.', '   ', 'Caixa.'], 3));
    expect(props.onChange).not.toHaveBeenCalled();
    act(() => recognition.onend?.());
    expect(props.onChange).toHaveBeenCalledWith(
      'Experiência anterior. Atendimento. Vendas. Caixa.',
    );
    expect(screen.queryByText('Atendimento. Vendas. Caixa.')).not.toBeInTheDocument();
  });

  it('uses the current controlled value and callbacks rather than the initial render', () => {
    const { props, rerender } = renderField();
    const recognition = start();
    const nextChange = jest.fn();
    rerender(<VoiceTextField {...props} value="Texto atualizado" onChange={nextChange} />);
    act(() => recognition.result(['com a fala']));
    expect(nextChange).not.toHaveBeenCalled();
    act(() => recognition.onend?.());
    expect(nextChange).toHaveBeenCalledWith('Texto atualizado com a fala');
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('waits for final results after stopping and releases the submit action on end', () => {
    jest.useFakeTimers();
    const { props } = renderField({ value: '  ' });
    const recognition = start();
    act(() => recognition.onstart?.());
    fireEvent.click(screen.getByRole('button', { name: 'Parar ditado' }));
    act(() => jest.advanceTimersByTime(0));
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Parar ditado' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Finalizando ditado…');
    expect(props.onBusyChange).toHaveBeenLastCalledWith(true);
    act(() => recognition.result(['Atendente']));
    expect(props.onChange).not.toHaveBeenCalled();
    act(() => recognition.onend?.());
    expect(props.onChange).toHaveBeenCalledWith('Atendente');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('button', { name: 'Falar para preencher' })).toBeEnabled();
  });

  it('cancels an active dictation without saving the recognized text', () => {
    const { props } = renderField({ value: 'Texto preservado' });
    const recognition = start();
    act(() => recognition.onstart?.());
    act(() => recognition.result(['fala descartada']));

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar ditado' }));

    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(props.onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('Texto preservado');
  });

  it('preserves speech emitted synchronously before the transcription card mounts', () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: class extends MockSpeechRecognition {
        start = jest.fn(() => this.result(['fala imediata']));
      },
    });
    renderField();
    start();
    expect(screen.getByLabelText('Ditado: Experiência')).toHaveTextContent('fala imediata');
  });

  it('ends naturally without restarting and allows a new session', () => {
    const { props } = renderField();
    const first = start();
    act(() => first.result(['Analista']));
    act(() => first.onend?.());
    expect(first.start).toHaveBeenCalledTimes(1);
    const second = start();
    act(() => first.onend?.());
    act(() => first.onstart?.());
    act(() => first.onerror?.({ error: 'network' }));
    act(() => first.result(['resultado antigo']));
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onBusyChange).toHaveBeenLastCalledWith(true);
    expect(second.start).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending permission request and ignores its delayed events', () => {
    const { props } = renderField();
    const recognition = start();
    fireEvent.click(screen.getByRole('button', { name: 'Parar ditado' }));
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(recognition.stop).not.toHaveBeenCalled();
    act(() => recognition.onstart?.());
    act(() => recognition.result(['não deve entrar']));
    act(() => recognition.onend?.());
    expect(props.onChange).not.toHaveBeenCalled();
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('restores typing when dictation is cancelled before accepting manual edits', () => {
    const { props } = renderField({ kind: 'input', value: 'Assistente' });
    const recognition = start();
    fireEvent.click(screen.getByRole('button', { name: 'Parar ditado' }));
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Auxiliar' } });
    expect(props.onChange).toHaveBeenLastCalledWith('Auxiliar');
    act(() => recognition.result(['fala atrasada']));
    expect(props.onChange).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Analista' } });
    expect(props.onChange).toHaveBeenLastCalledWith('Analista');
  });

  it('cancels with Escape but leaves normal keyboard input alone', () => {
    renderField();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'a' });
    const recognition = start();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Parar ditado' }), { key: 'Escape' });
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(recognition.abort).toHaveBeenCalledTimes(1);
  });

  it('reports silence on natural end and permits another attempt', () => {
    renderField({ value: 'Texto preservado' });
    const recognition = start();
    act(() => recognition.onend?.());
    expect(screen.getByRole('status')).toHaveTextContent('Não ouvimos nenhuma fala');
    expect(screen.getByRole('textbox')).toHaveValue('Texto preservado');
    start();
    expect(screen.getByRole('status')).toHaveTextContent('Preparando o microfone');
  });

  it.each([
    ['not-allowed', 'O microfone não foi autorizado'],
    ['service-not-allowed', 'O microfone não foi autorizado'],
    ['no-speech', 'Não ouvimos nenhuma fala'],
    ['network', 'Não foi possível usar o ditado'],
    ['audio-capture', 'Não foi possível usar o ditado'],
  ])('handles %s without losing the current text', (error, message) => {
    const { props } = renderField({ value: 'Texto preservado' });
    const recognition = start();
    act(() => recognition.onerror?.({ error }));
    expect(screen.getByRole('status')).toHaveTextContent(message);
    expect(screen.getByRole('textbox')).toHaveValue('Texto preservado');
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
    expect(props.onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Editado' } });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('uses webkitSpeechRecognition when the unprefixed API is absent', () => {
    restore();
    restore = installSpeechRecognition(true);
    renderField();
    expect(start().start).toHaveBeenCalledTimes(1);
  });

  it('hides speech when neither API is supported and logs the reason only to the console', () => {
    restore();
    restore = () => undefined;
    const warning = jest.spyOn(console, 'warn').mockImplementation();
    const { props } = renderField();
    expect(screen.queryByRole('button', { name: 'Falar para preencher' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(warning).toHaveBeenCalledWith(
      'Ditado indisponível: SpeechRecognition não é suportado neste navegador.',
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Digitado' } });
    expect(props.onChange).toHaveBeenCalledWith('Digitado');
    expect(MockSpeechRecognition.instances).toHaveLength(0);
  });

  it('handles support disappearing between render and click', () => {
    renderField();
    const warning = jest.spyOn(console, 'warn').mockImplementation();
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: undefined });
    start();
    expect(screen.queryByRole('button', { name: 'Falar para preencher' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(warning).toHaveBeenCalledWith(
      'Ditado indisponível: SpeechRecognition não é suportado neste navegador.',
    );
  });

  it('honors the processing state of its parent', () => {
    renderField({ disabled: true });
    expect(screen.getByRole('textbox')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Falar para preencher' }));
    expect(MockSpeechRecognition.instances).toHaveLength(0);
  });

  it('keeps stopping available when the parent starts processing during dictation', () => {
    jest.useFakeTimers();
    const { props, rerender } = renderField();
    const recognition = start();
    act(() => recognition.onstart?.());
    rerender(<VoiceTextField {...props} disabled />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Parar ditado' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Parar ditado' }));
    act(() => jest.advanceTimersByTime(0));
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    act(() => recognition.onend?.());
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Falar para preencher' })).toBeDisabled();
  });

  it('also cancels with Escape while the microphone button has focus', () => {
    renderField();
    const recognition = start();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Parar ditado' }), { key: 'Escape' });
    expect(recognition.abort).toHaveBeenCalledTimes(1);
  });

  it('recovers when construction fails before a session exists', () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: class {
        constructor() {
          throw new Error('Browser service unavailable');
        }
      },
    });
    const { props } = renderField();
    start();
    expect(screen.getByRole('status')).toHaveTextContent('Não foi possível iniciar o ditado');
    expect(props.onBusyChange).not.toHaveBeenCalled();
  });

  it('releases a session when start throws', () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: class extends MockSpeechRecognition {
        start = jest.fn(() => {
          throw new Error('start failure');
        });
      },
    });
    const { props } = renderField();
    const recognition = start();
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('status')).toHaveTextContent('Não foi possível iniciar o ditado');
  });

  it('recovers from a synchronous stop failure', () => {
    jest.useFakeTimers();
    const { props } = renderField();
    const recognition = start();
    act(() => recognition.onstart?.());
    recognition.stop.mockImplementation(() => {
      throw new Error('Already stopped');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Parar ditado' }));
    act(() => jest.advanceTimersByTime(0));
    expect(screen.getByRole('status')).toHaveTextContent('Não foi possível concluir o ditado');
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
    expect(recognition.abort).toHaveBeenCalledTimes(1);
  });

  it('releases the microphone if the browser never finishes stopping', () => {
    jest.useFakeTimers();
    const { props } = renderField();
    const recognition = start();
    act(() => recognition.onstart?.());
    fireEvent.click(screen.getByRole('button', { name: 'Parar ditado' }));
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByRole('status')).toHaveTextContent('Não foi possível concluir o ditado');
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('aborts on unmount, clears timers and ignores all delayed browser events', () => {
    jest.useFakeTimers();
    const { props, unmount } = renderField();
    const recognition = start();
    act(() => recognition.onstart?.());
    fireEvent.click(screen.getByRole('button', { name: 'Parar ditado' }));
    recognition.abort.mockImplementation(() => {
      throw new Error('Already stopped');
    });
    unmount();
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
    act(() => {
      recognition.onstart?.();
      recognition.result(['resultado tardio']);
      recognition.onerror?.({ error: 'no-speech' });
      recognition.onend?.();
      jest.advanceTimersByTime(5000);
    });
    expect(props.onChange).not.toHaveBeenCalled();
    expect(recognition.abort).toHaveBeenCalledTimes(1);
  });
});
