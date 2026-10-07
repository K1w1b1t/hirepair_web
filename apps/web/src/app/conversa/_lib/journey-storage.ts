import {
  ANALYSIS_KEY,
  archetypes,
  objectives,
  tones,
  type JobAnalysisResult,
  type JobDraft,
  type JobPreferences,
} from './job-analysis';
import { readBrowserValue, writeBrowserValue } from './browser-storage';
import { inputFingerprint, isJobAnalysisResult } from './guest-api';
export const initialDraft: JobDraft = {
  hasJob: true,
  jobText: '',
  targetRole: '',
  accepted: false,
};
export interface JourneySnapshot {
  draft: JobDraft;
  result?: JobAnalysisResult;
  preferences?: JobPreferences;
  inputHash?: string;
}
function validDraft(value: unknown): value is JobDraft {
  return (
    !!value &&
    typeof value === 'object' &&
    'hasJob' in value &&
    typeof value.hasJob === 'boolean' &&
    'jobText' in value &&
    typeof value.jobText === 'string' &&
    'targetRole' in value &&
    typeof value.targetRole === 'string'
  );
}
function validPreferences(value: unknown): value is JobPreferences {
  if (!value || typeof value !== 'object') return false;
  const preferences = value as JobPreferences;
  return (
    archetypes.some(({ value }) => value === preferences.archetype) &&
    objectives.some(({ value }) => value === preferences.objective) &&
    tones.some(({ value }) => value === preferences.tone)
  );
}
export async function restoreJourney(
  documents: Array<{ id: string; text: string }>,
): Promise<JourneySnapshot> {
  try {
    const saved = JSON.parse(readBrowserValue(ANALYSIS_KEY) ?? 'null') as {
      version?: number;
      draft?: unknown;
      result?: unknown;
      preferences?: unknown;
      inputHash?: string;
    } | null;
    const draft = validDraft(saved?.draft)
      ? { ...saved.draft, accepted: false }
      : { ...initialDraft };
    if (
      saved?.version === 2 &&
      documents.length > 0 &&
      isJobAnalysisResult(saved.result) &&
      validPreferences(saved.preferences) &&
      saved.inputHash === (await inputFingerprint(documents, draft))
    )
      return {
        draft,
        result: saved.result,
        preferences: saved.preferences,
        inputHash: saved.inputHash,
      };
    return { draft };
  } catch {
    return { draft: { ...initialDraft } };
  }
}
export function persistJourney(snapshot: JourneySnapshot): void {
  writeBrowserValue(
    ANALYSIS_KEY,
    JSON.stringify({ version: 2, ...snapshot, draft: { ...snapshot.draft, accepted: false } }),
  );
}
