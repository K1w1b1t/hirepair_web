import type { Session } from './contracts';
import { canWrite } from './engine';
import { selectedFactIds } from './guided';

export function writingSnapshot(session: Session) {
  if (!canWrite(session)) throw new Error('WRITING_NOT_AUTHORIZED');
  const ids = selectedFactIds(session);
  return {
    sessionId: session.id,
    revision: session.revision,
    inputs: { ...session.inputs },
    facts: session.facts
      .filter((fact) => ids.includes(fact.id))
      .map((fact) => ({
        id: fact.id,
        revision: fact.revision,
        experienceId: fact.experienceId,
        text: fact.text,
        origin: { ...fact.origin },
      })),
  };
}

export interface ResumeUnit {
  id: string;
  text: string;
  factIds: string[];
  criterionIds: string[];
}
export interface ResumeSection {
  id: string;
  title: string;
  experienceId: string | null;
  units: ResumeUnit[];
}
export interface ResumeDraft {
  version: 1;
  sections: ResumeSection[];
  explanation: string;
}
export interface ManualResumeFact {
  id: string;
  text: string;
  origin: 'user-edit';
  confirmed: boolean;
}
export interface ResumeWriting {
  authorization?: string;
  manualFacts?: ManualResumeFact[];
  status: 'pending' | 'failed' | 'review' | 'approved';
  key: string;
  inputHash: string;
  original: ResumeDraft | null;
  draft: ResumeDraft | null;
  approval: { hash: string; profileHash: string; approvedAt: number } | null;
}
const unitSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    text: { type: 'string' },
    factIds: { type: 'array', items: { type: 'string' } },
    criterionIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'text', 'factIds', 'criterionIds'],
};
export class ResumeEvidencePending extends Error {}
export const RESUME_WRITING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    version: { type: 'integer', enum: [1] },
    pending: { type: ['string', 'null'] },
    explanation: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          experienceId: { type: ['string', 'null'] },
          units: { type: 'array', items: unitSchema },
        },
        required: ['id', 'title', 'experienceId', 'units'],
      },
    },
  },
  required: ['version', 'explanation', 'sections', 'pending'],
};
function closed(value: unknown, keys: string[]): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => key in value)
  );
}
const string = (value: unknown): value is string =>
  typeof value === 'string' && !!value.trim() && value.length <= 1200;
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(string) && new Set(value).size === value.length;
export function parseResumeWriting(raw: string, session: Session): ResumeDraft {
  const snapshot = writingSnapshot(session);
  const parsed: unknown = JSON.parse(raw);
  let value = parsed;
  if (closed(parsed, ['version', 'explanation', 'sections', 'pending'])) {
    if (parsed.version !== 1) throw new Error('INVALID_RESUME');
    if (string(parsed.pending)) throw new ResumeEvidencePending(parsed.pending);
    if (parsed.pending !== null) throw new Error('INVALID_RESUME');
    const { pending: _pending, ...content } = parsed;
    void _pending;
    value = content;
  }
  if (
    !closed(value, ['version', 'explanation', 'sections']) ||
    value.version !== 1 ||
    !string(value.explanation) ||
    !Array.isArray(value.sections) ||
    !value.sections.length ||
    value.sections.length > 12
  )
    throw new Error('INVALID_RESUME');
  const ids = new Set<string>();
  const density = new Map<string, number>();
  for (const section of value.sections) {
    if (
      !closed(section, ['id', 'title', 'experienceId', 'units']) ||
      !string(section.id) ||
      ids.has(section.id) ||
      !string(section.title) ||
      !Array.isArray(section.units) ||
      !section.units.length
    )
      throw new Error('INVALID_RESUME_SECTION');
    ids.add(section.id);
    const experience = session.experiences.find((item) => item.id === section.experienceId);
    if (section.experienceId !== null && !experience) throw new Error('INVALID_EXPERIENCE');
    const max =
      experience && ['informal', 'project', 'education', 'course'].includes(experience.kind ?? '')
        ? 2
        : 4;
    const densityKey = experience ? `experience:${experience.id}` : `section:${section.id}`;
    const total = (density.get(densityKey) ?? 0) + section.units.length;
    density.set(densityKey, total);
    if (total > max) throw new Error('RESUME_TOO_DENSE');
    for (const unit of section.units) {
      if (
        !closed(unit, ['id', 'text', 'factIds', 'criterionIds']) ||
        !string(unit.id) ||
        ids.has(unit.id) ||
        !string(unit.text) ||
        !strings(unit.factIds) ||
        !unit.factIds.length ||
        !strings(unit.criterionIds)
      )
        throw new Error('INVALID_RESUME_UNIT');
      ids.add(unit.id);
      const factIds = unit.factIds;
      const facts = factIds.map((id) => snapshot.facts.find((fact) => fact.id === id));
      if (
        facts.some((fact) => !fact || (experience && fact.experienceId !== experience.id)) ||
        unit.criterionIds.some(
          (id) =>
            !session.links.some(
              (link) =>
                link.criterionId === id &&
                link.factIds.some((factId) => factIds.includes(factId)) &&
                !['contradiction', 'declared_absence', 'unknown'].includes(link.status),
            ),
        )
      )
        throw new Error('UNGROUNDED_RESUME_UNIT');
      const support = facts.map((fact) => fact!.text).join(' ');
      const numbers: string[] = unit.text.match(/\d+(?:[.,]\d+)?%?/g) ?? [];
      const supportedNumbers: string[] = support.match(/\d+(?:[.,]\d+)?%?/g) ?? [];
      if (numbers.some((number) => !supportedNumbers.includes(number)))
        throw new Error('UNSUPPORTED_NUMBER');
      const protectedTerms =
        /\b(?:Excel|Python|SAP|Power BI|SQL|JavaScript|TypeScript|Scrum|AWS|Azure|CNH|NR-?\d+|certificad[oa]|liderou|gerenciou|sênior|senior|produção)\b/gi;
      if (
        (unit.text.match(protectedTerms) ?? []).some(
          (term) => !support.toLowerCase().includes(term.toLowerCase()),
        )
      )
        throw new Error('UNSUPPORTED_CLAIM');
    }
  }
  if (
    value.sections
      .flatMap((section: ResumeSection) => section.units)
      .reduce((total: number, unit: ResumeUnit) => total + unit.text.length, 0) > 6000
  )
    throw new Error('RESUME_TOO_DENSE');
  return value as unknown as ResumeDraft;
}

/** Manual declarations are confirmed only by the final document approval. */
export function manualResumeFacts(draft: ResumeDraft) {
  return draft.sections.flatMap((section) =>
    section.units
      .filter((unit) => !unit.factIds.length)
      .map((unit) => ({
        id: `edit:${unit.id}`,
        text: unit.text,
        origin: 'user-edit' as const,
        confirmed: false,
      })),
  );
}
export function resumeContent(
  session: Session,
  draft: ResumeDraft,
): import('./contracts').GroundedContent {
  return {
    id: 'resume-content',
    version: (session.content?.version ?? 0) + 1,
    inputs: { ...session.inputs },
    dependencies: ['resumes', 'job', 'objective', 'facts'],
    valid: true,
    sections: draft.sections.flatMap((section) =>
      section.units.map((unit) => ({
        text: unit.text,
        factIds: unit.factIds.length ? unit.factIds : [`edit:${unit.id}`],
      })),
    ),
  };
}

export function writingAuthorization(session: Session): string {
  return JSON.stringify({
    inputs: session.inputs,
    selection: session.selection,
    confirmation: session.confirmation,
    strategy: session.strategy,
    facts: session.facts.map(({ id, revision, usable }) => ({ id, revision, usable })),
  });
}

export function approveResume(
  session: Session,
  approval: NonNullable<ResumeWriting['approval']>,
  profileReady: boolean,
): Session {
  const writing = session.writing;
  if (
    !profileReady ||
    !writing?.draft ||
    !writing.draft.sections.length ||
    !canWrite(session) ||
    (writing.authorization && writing.authorization !== writingAuthorization(session))
  )
    throw new Error('INVALID_RESUME_APPROVAL');
  return {
    ...session,
    content: resumeContent(session, writing.draft),
    writing: {
      ...writing,
      status: 'approved',
      manualFacts: manualResumeFacts(writing.draft).map((fact) => ({ ...fact, confirmed: true })),
      approval,
    },
  };
}
