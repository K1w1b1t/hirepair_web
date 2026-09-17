import type { DiagnosticFinding } from './diagnostic';
import type { ExtractedText } from './extract-text';

const DATABASE_NAME = 'hirepair-resumes';
const STORE_NAME = 'resumes';
const DATABASE_VERSION = 1;

export type StoredResume = ExtractedText & {
  id: string;
  findings: DiagnosticFinding[];
  createdAt: number;
};

let fallbackResumes: StoredResume[] = [];

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
    reject: (reason?: unknown) => void,
  ) => void,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        operation(transaction.objectStore(STORE_NAME), resolve, reject);
        transaction.addEventListener('complete', () => database.close());
        transaction.addEventListener('error', () => reject(transaction.error));
        transaction.addEventListener('abort', () => reject(transaction.error));
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
        request.addEventListener('error', () => reject(request.error));
      }),
    );
    return storedResumes.length > 0 ? storedResumes : sortResumes(fallbackResumes);
  } catch {
    return sortResumes(fallbackResumes);
  }
}

export async function saveStoredResume(resume: StoredResume): Promise<void> {
  fallbackResumes = sortResumes([
    ...fallbackResumes.filter((item) => item.id !== resume.id),
    resume,
  ]);
  if (!canUseIndexedDb()) return;
  try {
    await runTransaction<void>('readwrite', (store, resolve, reject) => {
      const request = store.put(resume);
      request.addEventListener('success', () => resolve());
      request.addEventListener('error', () => reject(request.error));
    });
  } catch {
    return;
  }
}

export async function deleteStoredResume(id: string): Promise<void> {
  fallbackResumes = fallbackResumes.filter((resume) => resume.id !== id);
  if (!canUseIndexedDb()) return;
  try {
    await runTransaction<void>('readwrite', (store, resolve, reject) => {
      const request = store.delete(id);
      request.addEventListener('success', () => resolve());
      request.addEventListener('error', () => reject(request.error));
    });
  } catch {
    return;
  }
}

export async function clearStoredResumes(): Promise<void> {
  fallbackResumes = [];
  if (!canUseIndexedDb()) return;
  try {
    await runTransaction<void>('readwrite', (store, resolve, reject) => {
      const request = store.clear();
      request.addEventListener('success', () => resolve());
      request.addEventListener('error', () => reject(request.error));
    });
  } catch {
    return;
  }
}

export function toStoredResume(
  document: ExtractedText,
  findings: DiagnosticFinding[],
): StoredResume {
  return {
    ...document,
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    findings,
    createdAt: Date.now(),
  };
}
