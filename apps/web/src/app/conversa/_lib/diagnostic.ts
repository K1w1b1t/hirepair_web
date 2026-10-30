import { applyCommand, attachDiagnostics, changeInput } from '@hirepair/interview-engine';
import { readEngine, saveEngine } from './engine-storage';
import { resumeStorageGeneration, updateStoredResume } from './resume-storage';
import {
  diagnoseDocument,
  type DiagnosticReport,
  type Strategy,
  type Session,
} from '@hirepair/interview-engine';
import type { StoredResume } from './resume-storage';
import { sanitizeMaterial } from './sanitize-material';
export async function sha256(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function diagnoseStoredDocuments(
  documents: StoredResume[],
  target: string,
  archetype?: Strategy['archetype'],
  session?: Session,
): Promise<DiagnosticReport[]> {
  const now = new Date();
  const nowMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
  return Promise.all(
    documents
      .filter((doc) => doc.materialKind !== 'story')
      .map(async (doc) => {
        const hash = await sha256(doc.text);
        const sourceVersion = await sha256(sanitizeMaterial(doc.text));
        const source = session?.sources.find(
          (source) => source.id === doc.id && source.version === sourceVersion,
        );
        // Quotes are mapped by exact content, never by offsets from the sanitized source.
        const experiences = source
          ? session!.experiences
              .filter(
                (e) =>
                  e.origin.sourceId === doc.id &&
                  e.origin.sourceVersion === sourceVersion &&
                  doc.text.includes(e.origin.quote),
              )
              .map((e) => ({
                id: e.id,
                quote: e.origin.quote,
                start: e.start,
                end: e.end,
                current: e.current,
              }))
          : [];
        const fileHash =
          doc.source === 'file' && doc.original && typeof doc.original.arrayBuffer === 'function'
            ? await sha256(await doc.original.arrayBuffer())
            : undefined;
        const document = {
          id: doc.id,
          hash,
          ...(fileHash ? { fileHash } : {}),
          text: doc.text,
          usedInApplications: doc.usedInApplications ?? 'unknown',
          ...(doc.pageCount === undefined ? {} : { pageCount: doc.pageCount }),
          ...(doc.pages ? { pages: doc.pages } : {}),
        };
        const contextVersion = await sha256(
          JSON.stringify({ rules: 1, document, target, archetype, experiences, nowMonth }),
        );
        const company = /(?:^|\n)empresa\s*:\s*([^\n]+)/iu.exec(target)?.[1].trim();
        return {
          ...diagnoseDocument({
            document,
            contextVersion,
            nowMonth,
            archetype,
            target: { company },
            experiences,
          }),
          sourceVersion,
        };
      }),
  );
}
export async function persistDiagnosticReports(
  documents: StoredResume[],
  reports: DiagnosticReport[],
): Promise<StoredResume[]> {
  const generation = resumeStorageGeneration();
  const updated = [];
  for (const doc of documents) {
    const report = reports.find((r) => r.document?.id === doc.id);
    if (doc.diagnostic?.contextVersion === report?.contextVersion) {
      updated.push(doc);
      continue;
    }
    updated.push(await updateStoredResume(doc.id, doc.revision ?? 0, { diagnostic: report }));
  }
  if (generation !== resumeStorageGeneration()) throw new Error('DOCUMENT_NOT_FOUND');
  const session =
    documents.length === 0 && typeof indexedDB === 'undefined' ? null : await readEngine();
  const sources = await Promise.all(
    documents.map(async (doc) => {
      const text = sanitizeMaterial(doc.text);
      return { id: doc.id, text, version: await sha256(text) };
    }),
  );
  const resumesHash = await sha256(JSON.stringify(sources));
  if (
    session &&
    (session.inputs.resumes !== resumesHash ||
      JSON.stringify(session.diagnostics ?? []) !== JSON.stringify(reports))
  ) {
    const hash = await sha256(JSON.stringify(reports.map((r) => r.contextVersion)));
    // Revision is part of the command identity: returning to an earlier context is a new change.
    const next = applyCommand(
      session,
      `diagnostics:${session.revision}:${hash}`,
      hash,
      session.revision,
      (s) => attachDiagnostics(changeInput(s, 'resumes', resumesHash), reports),
    );
    await saveEngine(next, session.revision);
  }
  return updated;
}
