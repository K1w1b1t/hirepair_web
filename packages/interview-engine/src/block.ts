import type { Extraction, Objective, Topic, Source } from './contracts';
import type { InterviewBlockResult } from './interview';
import {
  EXTRACTION_SCHEMA,
  CRITERIA_SCHEMA,
  matches,
  parseExtraction,
  parseCriteria,
} from './schemas';
export interface InterviewBlockRequest {
  version: 1;
  sessionId: string;
  funnelSessionId: string;
  revision: number;
  inputsHash: string;
  objective: Objective;
  jobText: string;
  targetRole: string;
  turns: Array<{ id: string; topicId: string; text: string }>;
  context: Extraction;
  topics: Topic[];
}
const str = { type: 'string', maxLength: 500 };
const ids = { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 100 } };
export const INTERVIEW_BLOCK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['extraction', 'analysis', 'assessments'],
  properties: {
    extraction: EXTRACTION_SCHEMA,
    analysis: { anyOf: [CRITERIA_SCHEMA, { type: 'null' }] },
    assessments: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topicId', 'sufficient', 'evidence', 'question', 'contradictionFactIds'],
        properties: {
          topicId: { type: 'string', maxLength: 500 },
          sufficient: { type: 'boolean' },
          evidence: { type: 'array', maxItems: 10, items: str },
          question: { anyOf: [str, { type: 'null' }] },
          contradictionFactIds: ids,
        },
      },
    },
  },
};
export function parseInterviewBlock(
  text: string,
  request: InterviewBlockRequest,
  sources: Source[],
): InterviewBlockResult {
  const value = JSON.parse(text) as Omit<InterviewBlockResult, 'version' | 'revision'>;
  if (!matches(value, INTERVIEW_BLOCK_SCHEMA)) throw new Error('INVALID_CONTRACT');
  const contextSources = request.context.experiences.map((e) => ({
    id: e.origin.sourceId,
    version: e.origin.sourceVersion,
    text: e.origin.quote,
  }));
  const extraction = parseExtraction(
    JSON.stringify({
      experiences: [...request.context.experiences, ...value.extraction.experiences],
      facts: value.extraction.facts,
    }),
    [...sources, ...contextSources],
  );
  if (
    value.extraction.facts.some(
      (f) =>
        request.context.facts.some((old) => old.id === f.id) ||
        !sources.some(
          (src) =>
            src.id === f.origin.sourceId &&
            src.version === f.origin.sourceVersion &&
            src.text.includes(f.origin.quote),
        ),
    )
  )
    throw new Error('INVALID_ORIGIN');
  const allFacts = [...request.context.facts, ...extraction.facts];
  const analysis =
    value.analysis === null
      ? null
      : parseCriteria(JSON.stringify(value.analysis), request.jobText, {
          experiences: extraction.experiences,
          facts: allFacts,
        });
  const topicIds = new Set(request.topics.map((t) => t.id));
  if (
    !value.assessments.length ||
    new Set(value.assessments.map((a) => a.topicId)).size !== value.assessments.length ||
    value.assessments.some(
      (a) =>
        !topicIds.has(a.topicId) ||
        a.contradictionFactIds.some((id) => !allFacts.some((f) => f.id === id)) ||
        (!a.sufficient && a.question === null),
    )
  )
    throw new Error('INVALID_REFERENCE');
  return {
    version: 1,
    revision: request.revision,
    extraction: { ...extraction, experiences: value.extraction.experiences },
    analysis,
    assessments: value.assessments,
  };
}
const string = (maxLength: number) => ({ type: 'string', maxLength });
const nullableId = { anyOf: [string(100), { type: 'null' }] };
export const INTERVIEW_REQUEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'version',
    'sessionId',
    'funnelSessionId',
    'revision',
    'inputsHash',
    'objective',
    'jobText',
    'targetRole',
    'turns',
    'context',
    'topics',
  ],
  properties: {
    version: { type: 'integer', minimum: 1, maximum: 1 },
    sessionId: string(100),
    funnelSessionId: string(100),
    revision: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    inputsHash: string(100),
    objective: {
      type: 'string',
      maxLength: 100,
      enum: [
        'ENTER_FAST',
        'MAXIMIZE_SALARY',
        'CHANGE_FIELD',
        'WORK_REMOTE',
        'BALANCE_STUDY_FAMILY',
      ],
    },
    jobText: { type: 'string', maxLength: 20_000, minLength: 0 },
    targetRole: { type: 'string', maxLength: 200, minLength: 0 },
    turns: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        required: ['id', 'topicId', 'text'],
        properties: { id: string(100), topicId: string(500), text: string(10000) },
      },
    },
    context: EXTRACTION_SCHEMA,
    topics: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        required: [
          'id',
          'criterionId',
          'experienceId',
          'missingEvidence',
          'reason',
          'impact',
          'uncertainty',
          'relevance',
        ],
        properties: {
          id: string(500),
          criterionId: nullableId,
          experienceId: nullableId,
          missingEvidence: string(500),
          reason: string(500),
          impact: { type: 'integer', minimum: 0, maximum: 3 },
          uncertainty: { type: 'integer', minimum: 0, maximum: 3 },
          relevance: { type: 'integer', minimum: 0, maximum: 3 },
        },
      },
    },
  },
};
export function validInterviewRequest(value: unknown): value is InterviewBlockRequest {
  if (!matches(value, INTERVIEW_REQUEST_SCHEMA)) return false;
  const request = value as InterviewBlockRequest;
  return (
    !!(request.jobText.trim() || request.targetRole.trim()) &&
    request.turns.length > 0 &&
    request.topics.length > 0 &&
    new Set(request.turns.map((t) => t.id)).size === request.turns.length &&
    request.turns.every((t) => request.topics.some((topic) => topic.id === t.topicId))
  );
}
