jest.mock('./resume-storage', () => ({
  __esModule: true,
  ...jest.requireActual('./resume-storage'),
}));
import { diagnoseStoredDocuments, sha256 } from './diagnostic';
import type { StoredResume } from './resume-storage';
const doc: StoredResume = {
  id: 'synthetic',
  text: 'CPF: 123.456.789-09',
  fileName: 'synthetic.txt',
  fileType: 'TXT',
  source: 'file',
  createdAt: 0,
  findings: [],
};
it('hashes the actual local text and keeps the sanitized source version separate', async () => {
  const reports = await diagnoseStoredDocuments([doc], 'Empresa: Boreal');
  expect(reports[0].document?.hash).toBe(await sha256(doc.text));
  expect(reports[0].sourceVersion).not.toBe(reports[0].document?.hash);
  expect(reports[0].findings[0].code).toBe('UNNECESSARY_PERSONAL_DATA');
});
it('invalidates context when usage, target or content changes and ignores stories', async () => {
  const initial = (await diagnoseStoredDocuments([doc], ''))[0];
  for (const [changed, target] of [
    [{ ...doc, usedInApplications: 'yes' as const }, ''],
    [doc, 'new'],
    [{ ...doc, text: 'Atendimento' }, ''],
  ] as const) {
    expect((await diagnoseStoredDocuments([changed], target))[0].contextVersion).not.toBe(
      initial.contextVersion,
    );
  }
  expect(await diagnoseStoredDocuments([{ ...doc, materialKind: 'story' }], '')).toEqual([]);
  expect(await diagnoseStoredDocuments([], '')).toEqual([]);
});

import 'fake-indexeddb/auto';
import { serialize, deserialize } from 'node:v8';
import { persistDiagnosticReports } from './diagnostic';
import { clearStoredResumes, saveStoredResume, listStoredResumes } from './resume-storage';
import { deleteEngine, readEngine, saveEngine } from './engine-storage';
import { createSession } from '@hirepair/interview-engine';
Object.defineProperty(globalThis, 'structuredClone', {
  configurable: true,
  value: (v: unknown) => deserialize(serialize(v)),
});
it('persists versioned findings locally, updates the existing engine and does not resurrect a deleted engine', async () => {
  await deleteEngine();
  await clearStoredResumes();
  await saveStoredResume(doc);
  const reports = await diagnoseStoredDocuments([doc], '');
  const updated = await persistDiagnosticReports([doc], reports);
  expect((await listStoredResumes())[0].diagnostic).toEqual(reports[0]);
  const session = createSession('s', 'f', { resumes: 'r', job: 'j', objective: 'o', facts: 'f' });
  await saveEngine(session, null);
  await persistDiagnosticReports(updated, reports);
  expect((await readEngine())?.diagnostics).toEqual(reports);
  const revision = (await readEngine())!.revision;
  await persistDiagnosticReports(updated, reports);
  expect((await readEngine())!.revision).toBe(revision);
  await deleteEngine();
  await persistDiagnosticReports(updated, reports);
  expect(await readEngine()).toBeNull();
});
it('maps structured candidate origins by source identity and preserves measured metadata and byte hash', async () => {
  const sourceVersion = await sha256(sanitizeMaterial(doc.text));
  const session = createSession('s', 'f', { resumes: '', job: '', objective: '', facts: '' });
  session.sources = [
    { id: 'other', version: sourceVersion, text: '' },
    { id: doc.id, version: 'old', text: '' },
    { id: doc.id, version: sourceVersion, text: sanitizeMaterial(doc.text) },
  ];
  const e = {
    id: 'e',
    title: 'Atendimento',
    start: null,
    end: null,
    current: null,
    origin: { sourceId: doc.id, sourceVersion, quote: doc.text },
  };
  session.experiences = [
    e,
    { ...e, id: 'wrong-id', origin: { ...e.origin, sourceId: 'other' } },
    { ...e, id: 'wrong-version', origin: { ...e.origin, sourceVersion: 'old' } },
    { ...e, id: 'wrong-quote', origin: { ...e.origin, quote: 'not local' } },
  ];
  const original = new File(['synthetic bytes'], 'synthetic.pdf');
  const bytes = new TextEncoder().encode('synthetic bytes').buffer;
  Object.defineProperty(original, 'arrayBuffer', { value: async () => bytes });
  const [report] = await diagnoseStoredDocuments(
    [{ ...doc, original, pageCount: 2, pages: [{ page: 1, start: 0, end: 19 }] }],
    '',
    'C_OPERATIONAL',
    session,
  );
  expect(report.document?.fileHash).toBe(await sha256(bytes));
  expect(report.findings.filter((f) => f.code === 'DATES_NEED_CLARIFICATION')).toHaveLength(1);
  expect(report.findings.some((f) => f.code === 'EXCESS_PAGES')).toBe(true);
  const old = { ...session, sources: [] };
  expect(
    (await diagnoseStoredDocuments([doc], '', undefined, old))[0].findings.some(
      (f) => f.code === 'DATES_NEED_CLARIFICATION',
    ),
  ).toBe(false);
});
import { sanitizeMaterial } from './sanitize-material';
it('does not promise persistence for an empty memory-only journey', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')!;
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
  try {
    expect(await persistDiagnosticReports([], [])).toEqual([]);
  } finally {
    Object.defineProperty(globalThis, 'indexedDB', descriptor);
  }
});
it('removes a cached diagnosis when a material is reclassified as a story', async () => {
  await clearStoredResumes();
  await saveStoredResume(doc);
  const reports = await diagnoseStoredDocuments([doc], '');
  const [cached] = await persistDiagnosticReports([doc], reports);
  expect(
    (await persistDiagnosticReports([{ ...cached, materialKind: 'story' }], []))[0].diagnostic,
  ).toBeUndefined();
});
import * as resumeStorage from './resume-storage';
it('rejects a diagnostic commit if deletion invalidates its generation', async () => {
  await clearStoredResumes();
  await saveStoredResume(doc);
  const reports = await diagnoseStoredDocuments([doc], '');
  const original = resumeStorage.updateStoredResume;
  const spy = jest
    .spyOn(resumeStorage, 'updateStoredResume')
    .mockImplementationOnce(async (...args) => {
      const value = await original(...args);
      await clearStoredResumes();
      return value;
    });
  try {
    await expect(persistDiagnosticReports([doc], reports)).rejects.toThrow('DOCUMENT_NOT_FOUND');
  } finally {
    spy.mockRestore();
  }
});
it('invalidates dependent confirmation/content when the effective imported source changes', async () => {
  await deleteEngine();
  await clearStoredResumes();
  await saveStoredResume(doc);
  const session = createSession('s', 'f', {
    resumes: 'old-source-hash',
    job: 'j',
    objective: 'o',
    facts: 'f',
  });
  session.confirmation = {
    id: 'confirmation',
    version: 1,
    inputs: { ...session.inputs },
    dependencies: ['resumes'],
    valid: true,
    factIds: ['f'],
  };
  session.content = {
    id: 'content',
    version: 1,
    inputs: { ...session.inputs },
    dependencies: ['resumes'],
    valid: true,
    sections: [],
  };
  await saveEngine(session, null);
  await persistDiagnosticReports([doc], await diagnoseStoredDocuments([doc], ''));
  const updated = (await readEngine())!;
  expect(updated.confirmation?.valid).toBe(false);
  expect(updated.content?.valid).toBe(false);
});
it('does not bind retained original bytes to a corrected textual version', async () => {
  const original = new File(['original bytes'], 'original.pdf');
  const read = jest.fn().mockResolvedValue(new ArrayBuffer(1));
  Object.defineProperty(original, 'arrayBuffer', { value: read });
  const [report] = await diagnoseStoredDocuments([{ ...doc, source: 'pasted', original }], '');
  expect(report.document?.fileHash).toBeUndefined();
  expect(read).not.toHaveBeenCalled();
});
it('enriches a legacy session whose source hash already matches but has no diagnostic field', async () => {
  await clearStoredResumes();
  await deleteEngine();
  await saveStoredResume(doc);
  const text = sanitizeMaterial(doc.text);
  const sources = [{ id: doc.id, text, version: await sha256(text) }];
  await saveEngine(
    createSession('s', 'f', {
      resumes: await sha256(JSON.stringify(sources)),
      job: 'j',
      objective: 'o',
      facts: 'f',
    }),
    null,
  );
  const reports = await diagnoseStoredDocuments([doc], '');
  await persistDiagnosticReports([doc], reports);
  expect((await readEngine())!.diagnostics).toEqual(reports);
});
