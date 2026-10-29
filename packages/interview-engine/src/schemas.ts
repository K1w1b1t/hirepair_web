import type { Extraction, CriteriaAnalysis, Source } from './contracts';
type Schema = {
  type?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  enum?: readonly unknown[];
  maximum?: number;
  minimum?: number;
  maxLength?: number;
  maxItems?: number;
  anyOf?: Schema[];
  additionalProperties?: boolean;
  required?: string[];
};
const str = (maxLength = 500): Schema => ({ type: 'string', maxLength });
const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] });
const enumeration = (values: string[]): Schema => ({
  type: 'string',
  enum: values,
  maxLength: 500,
});
const object = (properties: Record<string, Schema>): Schema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const array = (items: Schema, maxItems = 30): Schema => ({ type: 'array', items, maxItems });
const origin = object({ sourceId: str(100), sourceVersion: str(64), quote: str(1000) });
export const EXTRACTION_SCHEMA = object({
  experiences: array(
    object({
      id: str(100),
      title: str(200),
      start: nullable(str(40)),
      end: nullable(str(40)),
      current: nullable({ type: 'boolean' }),
      origin,
    }),
  ),
  facts: array(object({ id: str(100), experienceId: str(100), text: str(), origin })),
});
export const CRITERIA_SCHEMA = object({
  criteria: array(
    object({
      id: str(100),
      text: str(),
      kind: enumeration(['explicit', 'implicit']),
      category: enumeration(['ELIMINATORY', 'NEGOTIABLE', 'DECORATIVE']),
      quote: nullable(str(1000)),
      reason: str(),
      evidenceNeeded: str(),
      objectiveBasis: { type: 'boolean' },
      relevance: { type: 'integer', minimum: 0, maximum: 3 },
    }),
    15,
  ),
  links: array(
    object({
      id: str(100),
      criterionId: str(100),
      experienceId: nullable(str(100)),
      factIds: array(str(100)),
      status: enumeration(['candidate', 'unknown']),
      declarationTurnId: { type: 'null' },
    }),
    30,
  ),
  archetype: enumeration([
    'A_FIRST_JOB',
    'B_CAREER_CHANGE',
    'C_OPERATIONAL',
    'D_SAME_FIELD_RETURN',
    'E_SPECIALIST',
  ]),
  reason: str(),
});
export function matches(value: unknown, schema: Schema): boolean {
  if (schema.anyOf) return schema.anyOf.some((item) => matches(value, item));
  if (schema.enum && !schema.enum.includes(value)) return false;
  switch (schema.type) {
    case 'null':
      return value === null;
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string' && !!value.trim() && value.length <= schema.maxLength!;
    case 'integer':
      return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= schema.minimum! &&
        value <= schema.maximum!
      );
    case 'array':
      return (
        Array.isArray(value) &&
        value.length <= schema.maxItems! &&
        value.every((item: unknown) => matches(item, schema.items!))
      );
    case 'object':
      return (
        !!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).length === schema.required!.length &&
        schema.required!.every(
          (key) =>
            Object.hasOwn(value, key) &&
            matches((value as Record<string, unknown>)[key], schema.properties![key]),
        )
      );
    default:
      return false;
  }
}
function parse<T>(text: string, schema: Schema): T {
  const value: unknown = JSON.parse(text);
  if (!matches(value, schema)) throw new Error('INVALID_CONTRACT');
  return value as T;
}
function unique(ids: string[]): void {
  if (new Set(ids).size !== ids.length) throw new Error('DUPLICATE_ID');
}
export function parseExtraction(text: string, sources: Source[]): Extraction {
  const result = parse<Extraction>(text, EXTRACTION_SCHEMA);
  unique(result.experiences.map((item) => item.id));
  unique(result.facts.map((item) => item.id));
  for (const item of [...result.experiences, ...result.facts]) {
    if (
      !sources.some(
        (source) =>
          source.id === item.origin.sourceId &&
          source.version === item.origin.sourceVersion &&
          source.text.includes(item.origin.quote),
      )
    )
      throw new Error('INVALID_ORIGIN');
  }
  if (
    result.facts.some(
      (fact) => !result.experiences.some((experience) => experience.id === fact.experienceId),
    )
  )
    throw new Error('INVALID_REFERENCE');
  return result;
}
function isObjectiveBarrier(criterion: CriteriaAnalysis['criteria'][number]): boolean {
  return (
    criterion.kind === 'explicit' &&
    criterion.objectiveBasis &&
    criterion.quote !== null &&
    /(?:obrigat[óo]ri|exigid|indispens[aá]vel)/i.test(criterion.quote) &&
    /(?:\bCNH\b|\bCREA\b|\bCOREN\b|\bCRMV\b|\bCRM\b|\bOAB\b|\bNR[- ]?\d+|forma[çc][ãa]o|diploma|disponibilidade|presencial|idioma)/i.test(
      criterion.quote,
    ) &&
    !/(?:desej[aá]vel|diferencial|prefer[eê]ncia)/i.test(criterion.quote)
  );
}
export function parseCriteria(text: string, job: string, extraction: Extraction): CriteriaAnalysis {
  const result = parse<CriteriaAnalysis>(text, CRITERIA_SCHEMA);
  unique(result.criteria.map((item) => item.id));
  unique(result.links.map((item) => item.id));
  for (const criterion of result.criteria) {
    if (
      (criterion.kind === 'explicit' && !criterion.quote) ||
      (criterion.quote !== null && !job.includes(criterion.quote))
    )
      throw new Error('INVALID_ORIGIN');
    if (criterion.category === 'ELIMINATORY' && !isObjectiveBarrier(criterion))
      criterion.category = 'NEGOTIABLE';
  }
  for (const link of result.links) {
    if (
      !result.criteria.some((item) => item.id === link.criterionId) ||
      (link.experienceId !== null &&
        !extraction.experiences.some((item) => item.id === link.experienceId)) ||
      link.factIds.some(
        (id) =>
          !extraction.facts.some(
            (fact) => fact.id === id && fact.experienceId === link.experienceId,
          ),
      ) ||
      (link.status === 'candidate' && !link.factIds.length) ||
      (link.status === 'unknown' && link.factIds.length)
    )
      throw new Error('INVALID_REFERENCE');
  }
  return result;
}
/** Validate the narrow server response before merging it with locally confirmed history. */
export function validatePreparation(
  value: unknown,
  job: string,
): asserts value is import('./contracts').PreparationResult {
  if (!value || typeof value !== 'object') throw new Error('INVALID_CONTRACT');
  const result = value as import('./contracts').PreparationResult;
  const s = result.session;
  if (
    result.version !== 1 ||
    s?.version !== 1 ||
    s.phase !== 'interview' ||
    !s.objective ||
    !s.plan?.valid ||
    !s.strategy?.valid ||
    !Array.isArray(s.sources) ||
    !Array.isArray(s.facts) ||
    !Array.isArray(s.experiences) ||
    !Array.isArray(s.criteria) ||
    !Array.isArray(s.links) ||
    s.facts.some((f) => f.confirmation !== 'candidate' || f.externallyVerified !== false)
  )
    throw new Error('INVALID_CONTRACT');
  parseExtraction(
    JSON.stringify({
      experiences: s.experiences,
      facts: s.facts.map(({ id, experienceId, text, origin }) => ({
        id,
        experienceId,
        text,
        origin,
      })),
    }),
    s.sources,
  );
  parseCriteria(
    JSON.stringify({
      criteria: s.criteria,
      links: s.links,
      archetype: s.strategy.archetype,
      reason: s.strategy.reason,
    }),
    job,
    { experiences: s.experiences, facts: s.facts },
  );
}
