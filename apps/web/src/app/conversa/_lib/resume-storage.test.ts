import 'fake-indexeddb/auto';
import { serialize, deserialize } from 'node:v8';
Object.defineProperty(globalThis, 'structuredClone', {
  configurable: true,
  value: (value: unknown) => deserialize(serialize(value)),
});
import {
  clearStoredResumes,
  deleteStoredResume,
  listStoredResumes,
  saveStoredResume,
  resumeStorageGeneration,
  toStoredResume,
} from './resume-storage';

const firstResume = {
  id: 'resume-1',
  text: 'Experiência em atendimento',
  fileName: 'curriculo.txt',
  source: 'file' as const,
  fileType: 'TXT' as const,
  findings: [],
  createdAt: 100,
};

const secondResume = {
  ...firstResume,
  id: 'resume-2',
  fileName: 'perfil.md',
  source: 'pasted' as const,
  createdAt: 200,
};

describe('resume storage', () => {
  beforeEach(async () => {
    await clearStoredResumes();
  });

  it('saves, lists in creation order, updates, and deletes local resumes', async () => {
    await saveStoredResume(firstResume);
    await saveStoredResume(secondResume);

    expect(await listStoredResumes()).toEqual([firstResume, secondResume]);

    const updated = { ...firstResume, text: 'Experiência atualizada' };
    await saveStoredResume(updated);
    expect(await listStoredResumes()).toEqual([updated, secondResume]);

    await deleteStoredResume(firstResume.id);
    expect(await listStoredResumes()).toEqual([secondResume]);
  });

  it('returns an empty list after clearing the database', async () => {
    await saveStoredResume(firstResume);
    await clearStoredResumes();

    expect(await listStoredResumes()).toEqual([]);
  });
});
it('reports whether local data was durably saved or cleared', async () => {
  expect(await saveStoredResume(firstResume)).toBe(true);
  expect(await clearStoredResumes()).toBe(true);
});
it('keeps an explicit memory-only fallback when IndexedDB is unavailable', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')!;
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
  try {
    expect(await clearStoredResumes()).toBe(false);
    expect(await saveStoredResume(firstResume)).toBe(false);
    expect(await listStoredResumes()).toEqual([firstResume]);
    await deleteStoredResume(firstResume.id);
    expect(await listStoredResumes()).toEqual([]);
  } finally {
    Object.defineProperty(globalThis, 'indexedDB', descriptor);
  }
});
it('reports request, transaction and open failures without losing the memory fallback', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')!;
  try {
    for (const mode of [
      'open',
      'request-null',
      'request-error',
      'error-null',
      'error-error',
      'abort-null',
      'abort-error',
    ] as const) {
      const operation = Object.assign(new EventTarget(), {
        result: [],
        error: mode.endsWith('error') ? new Error('quota') : null,
      });
      const store = {
        getAll: () => operation,
        put: () => operation,
        delete: () => operation,
        clear: () => operation,
      };
      const tx = Object.assign(new EventTarget(), {
        error: mode.endsWith('error') ? new Error('quota') : null,
        objectStore: () => store,
      });
      const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore: jest.fn(),
        transaction: () => tx,
        close: jest.fn(),
      };
      const open = () => {
        const request = Object.assign(new EventTarget(), { result: db, error: new Error('open') });
        setTimeout(() => {
          if (mode === 'open') {
            request.dispatchEvent(new Event('error'));
            return;
          }
          request.dispatchEvent(new Event('upgradeneeded'));
          request.dispatchEvent(new Event('success'));
          queueMicrotask(() => {
            if (mode.startsWith('request')) operation.dispatchEvent(new Event('error'));
            else tx.dispatchEvent(new Event(mode.startsWith('abort') ? 'abort' : 'error'));
          });
        }, 0);
        return request;
      };
      Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open } });
      expect(await saveStoredResume(firstResume)).toBe(false);
      expect(await listStoredResumes()).toEqual([firstResume]);
      await deleteStoredResume(firstResume.id);
      expect(await clearStoredResumes()).toBe(false);
    }
  } finally {
    Object.defineProperty(globalThis, 'indexedDB', descriptor);
  }
});
it('generates local document identities even when Web Crypto is unavailable', () => {
  const crypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
  try {
    const value = toStoredResume(
      { text: 'Atendeu clientes', fileName: 'cv.txt', source: 'pasted', fileType: 'TXT' },
      [],
    );
    expect(value.id).toMatch(/^\d+-\d+$/);
  } finally {
    Object.defineProperty(globalThis, 'crypto', crypto);
  }
});

it('does not resurrect an import whose extraction started before deletion', async () => {
  const generation = resumeStorageGeneration();
  await clearStoredResumes();
  expect(await saveStoredResume(firstResume, generation)).toBe(false);
  expect(await listStoredResumes()).toEqual([]);
});
