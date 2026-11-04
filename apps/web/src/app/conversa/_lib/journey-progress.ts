import { transaction } from './engine-storage';
export type JourneyPhase = 'materials' | 'job' | 'recommendations' | 'interview';
export interface JourneyProgress {
  id: string;
  phase: JourneyPhase;
  withoutResume: boolean;
}
export async function readProgress(): Promise<JourneyProgress | null> {
  return transaction('readonly', (store, set) => {
    const r = store.get('journey');
    r.onsuccess = () => set(r.result ?? null);
  });
}
export async function startProgress(): Promise<JourneyProgress> {
  return transaction('readwrite', (store, set) => {
    const r = store.get('journey');
    r.onsuccess = () => {
      const entry = r.result ?? {
        id: crypto.randomUUID(),
        phase: 'materials',
        withoutResume: false,
      };
      store.put(entry, 'journey');
      set(entry);
    };
  });
}
export async function saveProgress(entry: JourneyProgress): Promise<void> {
  return transaction('readwrite', (store, set, fail) => {
    const r = store.get('journey');
    r.onsuccess = () => {
      if (r.result?.id !== entry.id) {
        fail(new Error('REVISION_CONFLICT'));
        return;
      }
      store.put(entry, 'journey');
      set(undefined);
    };
  });
}
export async function readLocalDraft<T>(key: string): Promise<T | null> {
  return transaction('readwrite', (store, set) => {
    const r = store.get('drafts');
    r.onsuccess = () => {
      if (
        key === 'interview-answer' &&
        r.result?.[key] &&
        Date.now() - (r.result[`saved-at:${key}`] ?? 0) >= 30 * 24 * 60 * 60 * 1000
      ) {
        store.put({ ...r.result, [key]: null }, 'drafts');
        set(null);
        return;
      }
      set(r.result?.[key] ?? null);
    };
  });
}
export async function saveLocalDraft(key: string, value: unknown): Promise<void> {
  return transaction('readwrite', (store, set, fail) => {
    const active = store.get('journey');
    active.onsuccess = () => {
      if (!active.result) {
        fail(new Error('REVISION_CONFLICT'));
        return;
      }
      const r = store.get('drafts');
      r.onsuccess = () => {
        store.put({ ...r.result, [key]: value, [`saved-at:${key}`]: Date.now() }, 'drafts');
        set(undefined);
      };
    };
  });
}
