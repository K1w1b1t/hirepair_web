import 'fake-indexeddb/auto';
import { serialize, deserialize } from 'node:v8';
import { transaction, deleteEngine } from './engine-storage';
import {
  readProgress,
  startProgress,
  saveProgress,
  readLocalDraft,
  saveLocalDraft,
} from './journey-progress';
Object.defineProperty(globalThis, 'structuredClone', {
  configurable: true,
  value: (value: unknown) => deserialize(serialize(value)),
});
it('keeps a singleton journey and drafts across reloads, rejecting discarded progress', async () => {
  await deleteEngine();
  expect(await readProgress()).toBeNull();
  const entry = await startProgress();
  expect(await startProgress()).toEqual(entry);
  expect(await readLocalDraft('answer')).toBeNull();
  await saveLocalDraft('answer', 'Não terminei de escrever');
  await saveLocalDraft('editor', { title: 'Resumo' });
  expect(await readLocalDraft('answer')).toBe('Não terminei de escrever');
  await saveProgress({ ...entry, phase: 'interview', withoutResume: true });
  expect(await readProgress()).toMatchObject({ phase: 'interview', withoutResume: true });
  await deleteEngine();
  expect(await readLocalDraft('answer')).toBeNull();
  await expect(saveProgress(entry)).rejects.toThrow('REVISION_CONFLICT');
  await expect(saveLocalDraft('answer', 'late')).rejects.toThrow('REVISION_CONFLICT');
});
it('expires unsent raw answers after thirty days while preserving document drafts', async () => {
  await startProgress();
  await saveLocalDraft('interview-answer', 'Relato ainda não enviado');
  expect(await readLocalDraft('interview-answer')).toBe('Relato ainda não enviado');
  const now = jest.spyOn(Date, 'now').mockReturnValue(1);
  await saveLocalDraft('interview-answer', 'Relato antigo');
  await saveLocalDraft('profile-editor', 'Nome local');
  now.mockRestore();
  expect(await readLocalDraft('interview-answer')).toBeNull();
  expect(await readLocalDraft('profile-editor')).toBe('Nome local');
  await transaction('readwrite', (store, set) => {
    store.put({ 'interview-answer': 'Rascunho antigo sem data' }, 'drafts');
    set(undefined);
  });
  expect(await readLocalDraft('interview-answer')).toBeNull();
  await saveLocalDraft('interview-answer', '');
  expect(await readLocalDraft('interview-answer')).toBe('');
});
