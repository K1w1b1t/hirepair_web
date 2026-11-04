import type { ResumeDraft, Strategy } from '@hirepair/interview-engine';
import type { HeaderProfile } from './engine-storage';
export interface ExportArtifact {
  blob: Blob;
  mime: 'application/pdf';
  format: 'pdf';
  fileName: string;
  contentHash: string;
  profileHash: string;
  fileHash: string;
  rendererVersion: string;
  layoutVersion: string;
  pageCount: number;
}
export interface PdfInput {
  document: ResumeDraft;
  profile: HeaderProfile;
  archetype: Strategy['archetype'];
}
export function pageLimit(archetype: PdfInput['archetype']): number {
  return archetype === 'D_SAME_FIELD_RETURN' || archetype === 'E_SPECIALIST' ? 2 : 1;
}
