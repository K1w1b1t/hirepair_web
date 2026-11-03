import { saveStoredResume, clearStoredResumes } from './resume-storage';
import { approveResume } from '@hirepair/interview-engine';
import { hashValue } from './interview-session';
import 'fake-indexeddb/auto';
import { serialize, deserialize } from 'node:v8';
import { createWritingTestSession } from '../../../../test/writing';
import { transaction, deleteEngine, readEngine, saveEngine } from './engine-storage';
import {
  completeResume,
  listCompletedResumes,
  readCompletedResume,
  type CompletedResume,
} from './completed-resumes';
Object.defineProperty(globalThis, 'structuredClone', {
  configurable: true,
  value: (value: unknown) => deserialize(serialize(value)),
});
const s = createWritingTestSession;
function fixture(): CompletedResume {
  const session = s();
  return {
    id: session.id,
    title: 'Atendente',
    approvedAt: 1,
    document: {
      version: 1,
      sections: [
        {
          id: 's',
          title: 'Resumo',
          experienceId: null,
          units: [{ id: 'u', text: 'Atendeu clientes', factIds: ['f'], criterionIds: [] }],
        },
      ],
      explanation: '',
    },
    profile: { name: 'Sintética', email: '', phone: '', confirmed: true },
    session,
    artifact: {
      blob: new Blob(['PDF']),
      mime: 'application/pdf',
      format: 'pdf',
      fileName: 'curriculo.pdf',
      contentHash: 'c',
      profileHash: 'p',
      fileHash: 'f',
      rendererVersion: 'v1',
      layoutVersion: 'v1',
      pageCount: 1,
    },
  };
}
it('archives atomically, survives journey deletion and rejects stale completion', async () => {
  await deleteEngine();
  await saveEngine(s(), null);
  const resume = fixture();
  resume.artifact.contentHash = await hashValue(resume.document);
  resume.artifact.profileHash = await hashValue(resume.profile);
  resume.session = approveResume(
    {
      ...resume.session,
      writing: {
        status: 'review',
        key: 'k',
        inputHash: 'h',
        original: resume.document,
        draft: resume.document,
        approval: null,
      },
    },
    { hash: resume.artifact.contentHash, profileHash: resume.artifact.profileHash, approvedAt: 1 },
    true,
  );
  await expect(completeResume(resume, 99)).rejects.toThrow('REVISION_CONFLICT');
  expect(await readEngine()).not.toBeNull();
  await saveStoredResume({
    id: 'source',
    text: 'Material de origem sintético',
    fileName: 'origem.txt',
    source: 'pasted',
    fileType: 'TXT',
    createdAt: 1,
    findings: [],
  });
  await completeResume(resume, 0);
  await clearStoredResumes();
  expect((await readCompletedResume('s'))?.materials).toEqual([
    expect.objectContaining({ text: 'Material de origem sintético' }),
  ]);
  expect(await readEngine()).toBeNull();
  await deleteEngine();
  expect(await readCompletedResume('s')).toMatchObject({ title: 'Atendente' });
  expect(await listCompletedResumes()).toHaveLength(1);
  await expect(completeResume(resume, 0)).rejects.toThrow('REVISION_CONFLICT');
  expect(await readCompletedResume('missing')).toBeNull();
});
it('rejects missing, stale or unauthorized export approval', async () => {
  const valid = fixture();
  valid.artifact.contentHash = await hashValue(valid.document);
  valid.artifact.profileHash = await hashValue(valid.profile);
  valid.session = approveResume(
    {
      ...valid.session,
      writing: {
        status: 'review',
        key: 'k',
        inputHash: 'h',
        original: valid.document,
        draft: valid.document,
        approval: null,
      },
    },
    { hash: valid.artifact.contentHash, profileHash: valid.artifact.profileHash, approvedAt: 1 },
    true,
  );
  const cases = [
    { ...valid, session: { ...valid.session, writing: undefined } },
    {
      ...valid,
      session: {
        ...valid.session,
        writing: { ...valid.session.writing!, status: 'review' as const },
      },
    },
    {
      ...valid,
      session: { ...valid.session, writing: { ...valid.session.writing!, approval: null } },
    },
    { ...valid, session: { ...valid.session, confirmation: null } },
    {
      ...valid,
      session: { ...valid.session, writing: { ...valid.session.writing!, authorization: 'stale' } },
    },
    { ...valid, artifact: { ...valid.artifact, contentHash: 'wrong' } },
    {
      ...valid,
      session: {
        ...valid.session,
        writing: {
          ...valid.session.writing!,
          approval: { ...valid.session.writing!.approval!, hash: 'wrong' },
        },
      },
    },
    { ...valid, artifact: { ...valid.artifact, profileHash: 'wrong' } },
    {
      ...valid,
      session: {
        ...valid.session,
        writing: {
          ...valid.session.writing!,
          approval: { ...valid.session.writing!.approval!, profileHash: 'wrong' },
        },
      },
    },
  ];
  for (const value of cases)
    await expect(completeResume(value, 0)).rejects.toThrow('INVALID_EXPORT_APPROVAL');
});
it('sorts approved resumes newest first without mixing imported materials', async () => {
  await transaction('readwrite', (store, set) => {
    store.put({ ...fixture(), id: 'new', approvedAt: 100 }, 'resume:new');
    store.put({ ...fixture(), id: 'old', approvedAt: 0 }, 'resume:old');
    set(undefined);
  });
  expect((await listCompletedResumes()).map((r) => r.id)).toEqual(['new', 's', 'old']);
});
