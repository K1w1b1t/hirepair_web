import type { DiagnosticReport } from '@hirepair/interview-engine';
import type { ExtractedText } from './extract-text';

const DATABASE_NAME = 'hirepair-resumes';
const STORE_NAME = 'resumes';
const DATABASE_VERSION = 1;
let fallbackId = 0;

export type StoredResume = ExtractedText & {
  original?: File;
  id: string;
  findings: unknown[];
  materialKind?: 'resume' | 'story';
  usedInApplications?: 'yes' | 'no' | 'unknown';
  revision?: number;
  diagnostic?: DiagnosticReport;
  createdAt: number;
};

let fallbackResumes: StoredResume[] = [];
let generation = 0;
export function resumeStorageGeneration(): number {
  return generation;
}

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener('upgradeneeded', () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
  });
}

function sortResumes(resumes: StoredResume[]): StoredResume[] {
  return [...resumes].sort((left, right) => left.createdAt - right.createdAt);
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (
    store: IDBObjectStore,
    resolve: (value: T) => void,
    reject: (reason: Error) => void,
  ) => void,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        let result: T;
        operation(
          transaction.objectStore(STORE_NAME),
          (value) => {
            result = value;
          },
          reject,
        );
        transaction.addEventListener('complete', () => {
          database.close();
          resolve(result);
        });
        transaction.addEventListener('abort', () => database.close());
        transaction.addEventListener('error', () =>
          reject(transaction.error ?? new Error('IndexedDB transaction failed.')),
        );
        transaction.addEventListener('abort', () =>
          reject(transaction.error ?? new Error('IndexedDB transaction aborted.')),
        );
      }),
  );
}

export async function listStoredResumes(): Promise<StoredResume[]> {
  if (!canUseIndexedDb()) return sortResumes(fallbackResumes);
  try {
    const storedResumes = sortResumes(
      await runTransaction<StoredResume[]>('readonly', (store, resolve, reject) => {
        const request = store.getAll();
        request.addEventListener('success', () => resolve(request.result as StoredResume[]));
        request.addEventListener('error', () =>
          reject(request.error ?? new Error('Could not list stored resumes.')),
        );
      }),
    );
    return storedResumes.length > 0 ? storedResumes : sortResumes(fallbackResumes);
  } catch {
    return sortResumes(fallbackResumes);
  }
}

export async function saveStoredResume(
  resume: StoredResume,
  expectedGeneration = generation,
): Promise<boolean> {
  if (expectedGeneration !== generation) return false;
  fallbackResumes = sortResumes([
    ...fallbackResumes.filter((item) => item.id !== resume.id),
    resume,
  ]);
  if (!canUseIndexedDb()) return false;
  try {
    await runTransaction<void>('readwrite', (store, resolve, reject) => {
      const request = store.put(resume);
      request.addEventListener('success', () => resolve());
      request.addEventListener('error', () =>
        reject(request.error ?? new Error('Could not save the resume.')),
      );
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteStoredResume(id: string): Promise<void> {
  generation++;
  fallbackResumes = fallbackResumes.filter((resume) => resume.id !== id);
  if (!canUseIndexedDb()) return;
  try {
    await runTransaction<void>('readwrite', (store, resolve, reject) => {
      const request = store.delete(id);
      request.addEventListener('success', () => resolve());
      request.addEventListener('error', () =>
        reject(request.error ?? new Error('Could not delete the resume.')),
      );
    });
  } catch {
    return;
  }
}

export async function clearStoredResumes(): Promise<boolean> {
  generation++;
  fallbackResumes = [];
  if (!canUseIndexedDb()) return false;
  try {
    await runTransaction<void>('readwrite', (store, resolve, reject) => {
      const request = store.clear();
      request.addEventListener('success', () => resolve());
      request.addEventListener('error', () =>
        reject(request.error ?? new Error('Could not clear stored resumes.')),
      );
    });
    return true;
  } catch {
    return false;
  }
}

export function toStoredResume(document: ExtractedText, findings: unknown[]): StoredResume {
  return {
    ...document,
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${fallbackId++}`,
    findings,
    createdAt: Date.now(),
  };
}

/** Compare and write in one transaction. Metadata writes cannot resurrect deleted materials. */
export async function updateStoredResume(
  id: string,
  revision: number,
  changes: Partial<
    Pick<StoredResume, 'materialKind' | 'usedInApplications' | 'diagnostic' | 'text'>
  >,
): Promise<StoredResume> {
  if (!canUseIndexedDb()) throw new Error('LOCAL_STORAGE_UNAVAILABLE');
  const updated = await runTransaction<StoredResume>('readwrite', (store, resolve, reject) => {
    const request = store.get(id);
    request.addEventListener('success', () => {
      const current = request.result as StoredResume | undefined;
      if (!current || (current.revision ?? 0) !== revision) {
        reject(new Error(current ? 'REVISION_CONFLICT' : 'DOCUMENT_NOT_FOUND'));
        return;
      }
      const replaced = changes.text !== undefined && changes.text !== current.text;
      const next: StoredResume = {
        ...current,
        diagnostic: undefined,
        ...changes,
        revision: revision + 1,
        ...(replaced
          ? {
              pageCount: undefined,
              pages: undefined,
              diagnostic: undefined,
              findings: [],
              usedInApplications: 'unknown',
              source: 'pasted',
              fileType: 'TXT',
            }
          : {}),
      };
      const write = store.put(next);
      write.addEventListener('success', () => resolve(next));
      write.addEventListener('error', () => reject(new Error('LOCAL_STORAGE_UNAVAILABLE')));
    });
    request.addEventListener('error', () => reject(new Error('LOCAL_STORAGE_UNAVAILABLE')));
  });
  fallbackResumes = fallbackResumes.map((doc) => (doc.id === id ? updated : doc));
  return updated;
}
