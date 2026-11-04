import { act, renderHook } from '@testing-library/react';
import { useGuidedVoice } from './use-guided-voice';
import {
  installSpeechRecognition,
  MockSpeechRecognition,
} from '../../../../test/mock-speech-recognition';
let restore: () => void;
beforeEach(() => {
  jest.useFakeTimers();
  restore = installSpeechRecognition();
});
afterEach(() => {
  restore();
  Reflect.deleteProperty(window, 'speechSynthesis');
  Reflect.deleteProperty(window, 'SpeechSynthesisUtterance');
  jest.useRealTimers();
});
it('supports missing recognition, constructor failures and start failures without submitting', () => {
  const send = jest.fn();
  const view = renderHook(() => useGuidedVoice('', jest.fn(), send));
  Reflect.deleteProperty(window, 'SpeechRecognition');
  act(() => view.result.current.microphone());
  expect(view.result.current.status).toBe('unsupported');
  Object.defineProperty(window, 'SpeechRecognition', {
    configurable: true,
    value: class {
      constructor() {
        throw new Error('unavailable');
      }
    },
  });
  act(() => view.result.current.microphone());
  expect(view.result.current.notice).toContain('não iniciou');
  Object.defineProperty(window, 'SpeechRecognition', {
    configurable: true,
    value: class extends MockSpeechRecognition {
      start = jest.fn(() => {
        throw new Error('denied');
      });
    },
  });
  act(() => view.result.current.microphone());
  expect(view.result.current.status).toBe('idle');
  expect(send).not.toHaveBeenCalled();
});
it('ignores callbacks from a stopped recognizer, tolerates abort failure and retains corrections', () => {
  const send = jest.fn(),
    draft = jest.fn();
  const view = renderHook(() => useGuidedVoice('Pergunta', draft, send));
  act(() => view.result.current.microphone());
  const old = MockSpeechRecognition.instances[0];
  const start = old.onstart,
    error = old.onerror,
    end = old.onend;
  old.abort.mockImplementation(() => {
    throw new Error('already ended');
  });
  act(() => view.result.current.pause());
  act(() => {
    start?.();
    error?.({ error: 'late' });
    end?.();
  });
  expect(view.result.current.status).toBe('idle');
  act(() => view.result.current.replaceDraft('Texto corrigido'));
  act(() => view.result.current.microphone());
  const current = MockSpeechRecognition.instances[1];
  act(() => current.result(['e completei']));
  act(() => current.onend?.());
  expect(draft).toHaveBeenLastCalledWith('Texto corrigido e completei');
  act(() => jest.advanceTimersByTime(5000));
  expect(send).toHaveBeenCalledWith('Texto corrigido e completei');
});
function synthesis(speak = jest.fn()) {
  const utterances: SpeechSynthesisUtterance[] = [];
  class Utterance {
    constructor() {
      utterances.push(this as unknown as SpeechSynthesisUtterance);
    }
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: Utterance,
  });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { cancel: jest.fn(), getVoices: () => [{ lang: 'en-US' }], speak },
  });
  return utterances;
}
it('discards already queued silence and narration callbacks after cancellation', () => {
  const timers = jest.spyOn(globalThis, 'setTimeout');
  const send = jest.fn();
  const view = renderHook(() => useGuidedVoice('Pergunta', jest.fn(), send));
  act(() => view.result.current.microphone());
  act(() => MockSpeechRecognition.instances[0].result(['Texto']));
  const silenceCallback = timers.mock.calls.find((c) => c[1] === 3000)![0] as () => void;
  act(() => view.result.current.pause());
  act(() => silenceCallback());
  expect(send).not.toHaveBeenCalled();
  const pause = view.result.current.pause;
  view.unmount();
  act(() => pause());
  synthesis();
  const narrated = renderHook(() => useGuidedVoice('Outra?', jest.fn(), send));
  const watchdog = timers.mock.calls.find((c) => c[1] === 20000)![0] as () => void;
  narrated.unmount();
  act(() => watchdog());
  timers.mockRestore();
});
it('recovers from a stalled or throwing speech synthesizer and ignores obsolete narration callbacks', () => {
  const utterances = synthesis();
  const view = renderHook(({ question }) => useGuidedVoice(question, jest.fn(), jest.fn()), {
    initialProps: { question: 'Primeira?' },
  });
  const first = utterances[0];
  view.rerender({ question: 'Segunda?' });
  act(() => {
    first.onend?.(new Event('end') as SpeechSynthesisEvent);
    first.onerror?.(new Event('error') as SpeechSynthesisErrorEvent);
  });
  expect(view.result.current.status).toBe('speaking');
  act(() => jest.advanceTimersByTime(20000));
  expect(view.result.current.notice).toContain('não iniciou');
  view.unmount();
  act(() => utterances[1].onend?.(new Event('end') as SpeechSynthesisEvent));
  synthesis(
    jest.fn(() => {
      throw new Error('blocked');
    }),
  );
  const failed = renderHook(() => useGuidedVoice('Pergunta', jest.fn(), jest.fn()));
  expect(failed.result.current.status).toBe('idle');
});
it('does not automatically send an erased preview or restart recording after writing', () => {
  const send = jest.fn();
  const view = renderHook(() => useGuidedVoice('Pergunta', jest.fn(), send));
  act(() => view.result.current.microphone());
  act(() => MockSpeechRecognition.instances[0].result(['Teste']));
  act(() => jest.advanceTimersByTime(3000));
  act(() => view.result.current.replaceDraft(''));
  act(() => jest.advanceTimersByTime(2000));
  expect(send).not.toHaveBeenCalled();
});
it('sends only final speech after three seconds of silence and a two second correction window', () => {
  const send = jest.fn(),
    draft = jest.fn();
  const { result } = renderHook(() => useGuidedVoice('Conte sua atividade', draft, send));
  act(() => result.current.microphone());
  const recognition = MockSpeechRecognition.instances[0];
  act(() => recognition.onstart?.());
  act(() => recognition.result(['Conferi o estoque']));
  act(() => jest.advanceTimersByTime(2999));
  expect(send).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1));
  expect(result.current.status).toBe('preview');
  act(() => jest.advanceTimersByTime(2000));
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith('Conferi o estoque');
});
it('does not send interim or empty results and preserves text when switching to writing', () => {
  const send = jest.fn();
  const { result } = renderHook(() => useGuidedVoice('Pergunta', jest.fn(), send));
  act(() => result.current.microphone());
  const r = MockSpeechRecognition.instances[0];
  act(() => r.result(['provisório'], 0, false));
  act(() => jest.advanceTimersByTime(10000));
  expect(send).not.toHaveBeenCalled();
  act(() => r.result(['Texto final']));
  act(() => jest.advanceTimersByTime(3000));
  act(() => result.current.pause());
  act(() => jest.advanceTimersByTime(5000));
  expect(send).not.toHaveBeenCalled();
});
it('resumes speaking during the preview and ignores late results after unmount', () => {
  const send = jest.fn();
  const view = renderHook(() => useGuidedVoice('Pergunta', jest.fn(), send));
  act(() => view.result.current.microphone());
  const r = MockSpeechRecognition.instances[0];
  const late = r.onresult;
  act(() => r.result(['Atendi clientes']));
  act(() => jest.advanceTimersByTime(3000));
  act(() => view.result.current.microphone());
  expect(MockSpeechRecognition.instances).toHaveLength(2);
  view.unmount();
  act(() => {
    late?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Tarde' } }] });
    jest.advanceTimersByTime(10000);
  });
  expect(send).not.toHaveBeenCalled();
});
it('announces microphone failures and never submits no-speech events', () => {
  const send = jest.fn();
  const { result } = renderHook(() => useGuidedVoice('Pergunta', jest.fn(), send));
  act(() => result.current.microphone());
  act(() => MockSpeechRecognition.instances[0].onerror?.({ error: 'not-allowed' }));
  expect(result.current.notice).toContain('Não foi possível');
  act(() => result.current.microphone());
  act(() => MockSpeechRecognition.instances[1].onend?.());
  expect(result.current.notice).toContain('Não ouvimos');
  expect(send).not.toHaveBeenCalled();
});
it('narrates each question once and starts recognition only after narration ends', () => {
  let utterance: SpeechSynthesisUtterance;
  class Utterance {
    lang = '';
    rate = 1;
    voice = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: Utterance,
  });
  const speak = jest.fn((value: SpeechSynthesisUtterance) => {
    utterance = value;
  });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { cancel: jest.fn(), getVoices: () => [{ lang: 'pt-BR' }], speak },
  });
  const view = renderHook(({ question }) => useGuidedVoice(question, jest.fn(), jest.fn()), {
    initialProps: { question: 'Primeira pergunta' },
  });
  expect(speak).toHaveBeenCalledTimes(1);
  act(() => utterance.onend?.(new Event('end') as SpeechSynthesisEvent));
  act(() => view.result.current.microphone());
  expect(MockSpeechRecognition.instances).toHaveLength(1);
  view.rerender({ question: 'Outra pergunta' });
  expect(speak).toHaveBeenCalledTimes(2);
  view.unmount();
  Reflect.deleteProperty(window, 'speechSynthesis');
  Reflect.deleteProperty(window, 'SpeechSynthesisUtterance');
});
it('lets the user recover from a blocked narration without ever recording the question', () => {
  let current: SpeechSynthesisUtterance;
  class Utterance {
    lang = '';
    rate = 1;
    voice = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: Utterance,
  });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      cancel: jest.fn(),
      getVoices: () => [],
      speak: (u: SpeechSynthesisUtterance) => {
        current = u;
      },
    },
  });
  const view = renderHook(() => useGuidedVoice('Pergunta', jest.fn(), jest.fn()));
  expect(MockSpeechRecognition.instances).toHaveLength(0);
  act(() => current.onerror?.(new Event('error') as SpeechSynthesisErrorEvent));
  expect(view.result.current.status).toBe('idle');
  act(() => view.result.current.microphone());
  act(() => current.onend?.(new Event('end') as SpeechSynthesisEvent));
  expect(MockSpeechRecognition.instances).toHaveLength(1);
  act(() => view.result.current.microphone());
  expect(view.result.current.status).toBe('idle');
  view.unmount();
  Reflect.deleteProperty(window, 'speechSynthesis');
  Reflect.deleteProperty(window, 'SpeechSynthesisUtterance');
});
