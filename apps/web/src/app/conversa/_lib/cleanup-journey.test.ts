import 'fake-indexeddb/auto';
import { serialize, deserialize } from 'node:v8';
import { cleanupJourney } from './cleanup-journey';
import { transaction, saveEngine, readEngine } from './engine-storage';
import { clearStoredResumes } from './resume-storage';
import { createWritingTestSession } from '../../../../test/writing';
import { cancelPreparation } from './guest-api';
jest.mock('./resume-storage', () => ({ clearStoredResumes: jest.fn(async () => true) }));
jest.mock('./guest-api', () => ({ cancelPreparation: jest.fn() }));
Object.defineProperty(globalThis, 'structuredClone', {
  configurable: true,
  value: (value: unknown) => deserialize(serialize(value)),
});
it('does nothing without a cleanup marker and preserves operational credentials', async () => {
  await cleanupJourney();
  expect(clearStoredResumes).not.toHaveBeenCalled();
});
it('discards active progress, keeps approved records and retries incomplete material cleanup', async () => {
  await saveEngine(createWritingTestSession(), null);
  await transaction('readwrite', (store, set) => {
    store.put({ id: 'kept' }, 'resume:kept');
    set(undefined);
  });
  localStorage.setItem('hirepair_job_analysis', 'private');
  localStorage.setItem('credential', 'keep');
  sessionStorage.setItem('hirepair_funnel_session_id', 'f');
  (clearStoredResumes as jest.Mock).mockResolvedValueOnce(false);
  await expect(cleanupJourney(true)).rejects.toThrow('LOCAL_STORAGE_UNAVAILABLE');
  expect(await readEngine()).toBeNull();
  await cleanupJourney();
  expect(localStorage.getItem('hirepair_job_analysis')).toBeNull();
  expect(sessionStorage.getItem('hirepair_funnel_session_id')).toBeNull();
  expect(localStorage.getItem('credential')).toBe('keep');
  expect(cancelPreparation).toHaveBeenCalled();
  expect(
    await transaction('readonly', (store, set) => {
      const r = store.get('resume:kept');
      r.onsuccess = () => set(r.result);
    }),
  ).toEqual({ id: 'kept' });
});
