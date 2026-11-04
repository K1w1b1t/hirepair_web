import { listStoredResumes, type StoredResume } from './resume-storage';
import {
  canWrite,
  writingAuthorization,
  type Session,
  type ResumeDraft,
} from '@hirepair/interview-engine';
import { transaction, type HeaderProfile } from './engine-storage';
import { hashValue } from './interview-session';
import type { ExportArtifact } from './pdf-contract';
export interface CompletedResume {
  id: string;
  title: string;
  approvedAt: number;
  document: ResumeDraft;
  profile: HeaderProfile;
  session: Session;
  artifact: ExportArtifact;
  materials?: StoredResume[];
  pdfApproval?: {
    fileHash: string;
    rendererVersion: string;
    layoutVersion: string;
    approvedAt: number;
  };
}
export async function listCompletedResumes(): Promise<CompletedResume[]> {
  return transaction('readonly', (store, set) => {
    const request = store.getAll(IDBKeyRange.bound('resume:', 'resume:\uffff'));
    request.onsuccess = () =>
      set((request.result as CompletedResume[]).sort((a, b) => b.approvedAt - a.approvedAt));
  });
}
export async function readCompletedResume(id: string): Promise<CompletedResume | null> {
  return transaction('readonly', (store, set) => {
    const request = store.get(`resume:${id}`);
    request.onsuccess = () => set(request.result ?? null);
  });
}
export async function completeResume(
  resume: CompletedResume,
  expectedRevision: number,
): Promise<void> {
  const writing = resume.session.writing;
  if (
    writing?.status !== 'approved' ||
    !writing.approval ||
    !canWrite(resume.session) ||
    (writing.authorization && writing.authorization !== writingAuthorization(resume.session)) ||
    resume.artifact.contentHash !== (await hashValue(resume.document)) ||
    writing.approval.hash !== resume.artifact.contentHash ||
    resume.artifact.profileHash !== (await hashValue(resume.profile)) ||
    writing.approval.profileHash !== resume.artifact.profileHash
  )
    throw new Error('INVALID_EXPORT_APPROVAL');
  const materials = await listStoredResumes();
  return transaction('readwrite', (store, set, fail) => {
    const request = store.get('active');
    request.onsuccess = () => {
      const current = request.result as Session | undefined;
      if (!current || current.id !== resume.id || current.revision !== expectedRevision) {
        fail(new Error('REVISION_CONFLICT'));
        return;
      }
      store.put(
        {
          ...resume,
          materials,
          pdfApproval: {
            fileHash: resume.artifact.fileHash,
            rendererVersion: resume.artifact.rendererVersion,
            layoutVersion: resume.artifact.layoutVersion,
            approvedAt: resume.approvedAt,
          },
        },
        `resume:${resume.id}`,
      );
      store.delete('active');
      store.delete('header-profile');
      store.delete('journey');
      store.delete('drafts');
      store.put(true, 'cleanup-pending');
      set(undefined);
    };
  });
}
