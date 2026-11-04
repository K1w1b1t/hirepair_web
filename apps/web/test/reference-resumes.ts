import type { PdfInput } from '../src/app/conversa/_lib/pdf-contract';
import references from './reference-resumes.v1.json';

// Versioned manual presentation data derived from authorized, anonymized references.
// These expected documents are never outputs attributed to the AI.
export const PRESENTATION_REFERENCES = references as Array<{
  id: string;
  expectedPages: number;
  input: PdfInput;
}>;
