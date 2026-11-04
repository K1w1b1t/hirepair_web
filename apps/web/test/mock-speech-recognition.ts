export class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = true;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult:
    | ((event: {
        resultIndex: number;
        results: Array<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null = null;
  start = jest.fn();
  stop = jest.fn();
  abort = jest.fn();

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }

  result(transcripts: string[], resultIndex = 0, isFinal = true) {
    this.onresult?.({
      resultIndex,
      results: transcripts.map((transcript) => ({ isFinal, 0: { transcript } })),
    });
  }
}

export function installSpeechRecognition(prefixed = false) {
  const names = ['SpeechRecognition', 'webkitSpeechRecognition'] as const;
  const descriptors = names.map((name) => Object.getOwnPropertyDescriptor(window, name));
  MockSpeechRecognition.instances = [];
  names.forEach((name, index) => {
    Object.defineProperty(window, name, {
      configurable: true,
      value: index === Number(prefixed) ? MockSpeechRecognition : undefined,
    });
  });
  return () => {
    names.forEach((name, index) => {
      const descriptor = descriptors[index];
      if (descriptor) Object.defineProperty(window, name, descriptor);
      else Reflect.deleteProperty(window, name);
    });
  };
}
