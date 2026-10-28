import 'fake-indexeddb/auto';
import { serialize, deserialize } from 'node:v8';
Object.defineProperty(globalThis, 'structuredClone', {
  configurable: true,
  value: (value: unknown) => deserialize(serialize(value)),
});
import { createSession } from '@hirepair/interview-engine';
import { readEngine, saveEngine, deleteEngine } from './engine-storage';
const s = () => createSession('s', 'f', { resumes: 'r', job: 'j', objective: 'o', facts: 'f' });
it('persists locally, rejects stale writes and deletion races', async () => {
  await deleteEngine();
  expect(await readEngine()).toBeNull();
  await saveEngine(s(), null);
  expect((await readEngine())?.id).toBe('s');
  await expect(saveEngine(s(), null)).rejects.toThrow('REVISION_CONFLICT');
  await saveEngine({ ...s(), revision: 1 }, 0);
  await deleteEngine();
  await expect(saveEngine({ ...s(), revision: 2 }, 1)).rejects.toThrow('REVISION_CONFLICT');
});
it('rejects cross-session writes and removes expired raw text on reopening', async () => {
  await deleteEngine();
  const session = s();
  session.turns = [
    {
      id: 't',
      recordedAt: 1,
      question: { text: 'Conte', topicId: 'topic' },
      answer: { text: 'Relato bruto', kind: 'specific' },
      factIds: [],
    },
  ];
  await saveEngine(session, null);
  expect((await readEngine())?.turns[0].answer.text).toBe('');
  expect((await readEngine())?.turns[0].id).toBe('t');
  await expect(saveEngine({ ...session, id: 'wrong' }, 0)).rejects.toThrow('REVISION_CONFLICT');
});
it('reports IndexedDB unavailability instead of pretending persistence succeeded', async () => {
  const open = jest.spyOn(indexedDB, 'open').mockImplementation(() => {
    const request = {} as IDBOpenDBRequest;
    setTimeout(() => request.onerror?.(new Event('error')), 0);
    return request;
  });
  await expect(readEngine()).rejects.toThrow('LOCAL_STORAGE_UNAVAILABLE');
  open.mockRestore();
});
it('reports transaction failure when a browser cannot clone or write data', async () => {
  await deleteEngine();
  const put = jest.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
    throw new DOMException('Quota', 'QuotaExceededError');
  });
  await expect(saveEngine(s(), null)).rejects.toThrow('LOCAL_STORAGE_UNAVAILABLE');
  put.mockRestore();
});
it('reports missing IndexedDB as an explicit local persistence failure', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')!;
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
  try {
    await expect(readEngine()).rejects.toThrow('LOCAL_STORAGE_UNAVAILABLE');
  } finally {
    Object.defineProperty(globalThis, 'indexedDB', descriptor);
  }
});
