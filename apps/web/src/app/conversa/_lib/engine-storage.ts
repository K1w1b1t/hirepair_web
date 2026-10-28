import { purgeRaw, type Session } from '@hirepair/interview-engine';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('LOCAL_STORAGE_UNAVAILABLE'));
      return;
    }
    const request = indexedDB.open('hirepair-interview', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('session');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('LOCAL_STORAGE_UNAVAILABLE'));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, set: (value: T) => void, fail: (error: Error) => void) => void,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('session', mode);
    let result: T;
    let failure: Error | null = null;
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(failure ?? new Error('LOCAL_STORAGE_UNAVAILABLE'));
    };
    operation(
      tx.objectStore('session'),
      (value) => {
        result = value;
      },
      (error) => {
        failure = error;
        tx.abort();
      },
    );
  });
}
export function readEngine(): Promise<Session | null> {
  return transaction('readwrite', (store, set) => {
    const request = store.get('active');
    request.onsuccess = () => {
      const current = (request.result as Session | undefined) ?? null;
      if (!current) {
        set(null);
        return;
      }
      const purged = purgeRaw(current, Date.now());
      if (purged !== current) store.put(purged, 'active');
      set(purged);
    };
  });
}
export function saveEngine(session: Session, expectedRevision: number | null): Promise<void> {
  return transaction('readwrite', (store, set, fail) => {
    const request = store.get('active');
    request.onsuccess = () => {
      const current = request.result as Session | undefined;
      if (
        (current?.revision ?? null) !== expectedRevision ||
        (current && current.id !== session.id)
      ) {
        fail(new Error('REVISION_CONFLICT'));
        return;
      }
      store.put(session, 'active');
      set(undefined);
    };
  });
}
export function deleteEngine(): Promise<void> {
  return transaction('readwrite', (store, set) => {
    store.clear();
    set(undefined);
  });
}
