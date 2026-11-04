import { parseExtraction, parseCriteria, matches, OBJECTIVES, VERSION } from './index';
import { extraction, analysis, source } from './fixtures';
const extract = (value: unknown = extraction, sources = [source]) =>
  parseExtraction(JSON.stringify(value), sources);
const criteria = (value: unknown = analysis, job = 'Atendimento') =>
  parseCriteria(JSON.stringify(value), job, extraction);
it('exports a version and explicit objective vocabulary', () => {
  expect(VERSION).toBe(1);
  expect(OBJECTIVES).toHaveLength(5);
});
it('validates source-backed structured outputs and rejects invented origins and IDs', () => {
  expect(extract()).toEqual(extraction);
  expect(criteria()).toEqual(analysis);
  expect(() => parseExtraction('bad', [])).toThrow();
  for (const bad of [
    null,
    1,
    [],
    {},
    { ...extraction, extra: 1 },
    { experiences: extraction.experiences, other: [] },
  ])
    expect(() => extract(bad)).toThrow();
  for (const origin of [
    { ...extraction.facts[0].origin, sourceId: 'x' },
    { ...extraction.facts[0].origin, sourceVersion: 'x' },
    { ...extraction.facts[0].origin, quote: 'Inventado' },
  ])
    expect(() => extract({ ...extraction, facts: [{ ...extraction.facts[0], origin }] })).toThrow(
      'INVALID_ORIGIN',
    );
  expect(() =>
    extract({ ...extraction, facts: [{ ...extraction.facts[0], experienceId: 'x' }] }),
  ).toThrow('INVALID_REFERENCE');
  expect(() =>
    extract({ ...extraction, facts: [extraction.facts[0], extraction.facts[0]] }),
  ).toThrow('DUPLICATE_ID');
  expect(
    extract({
      ...extraction,
      experiences: [{ ...extraction.experiences[0], start: null, end: null, current: null }],
    }),
  ).toBeTruthy();
});
it('downgrades speculative eliminatory criteria and rejects missing or fabricated excerpts', () => {
  for (const item of [
    { ...analysis.criteria[0], quote: null },
    { ...analysis.criteria[0], quote: 'inventado' },
  ])
    expect(() => criteria({ ...analysis, criteria: [item] })).toThrow('INVALID_ORIGIN');
  expect(
    criteria({
      ...analysis,
      criteria: [
        { ...analysis.criteria[0], kind: 'implicit', category: 'ELIMINATORY', quote: null },
      ],
    }).criteria[0].category,
  ).toBe('NEGOTIABLE');
  expect(
    criteria({ ...analysis, criteria: [{ ...analysis.criteria[0], category: 'ELIMINATORY' }] })
      .criteria[0].category,
  ).toBe('NEGOTIABLE');
  expect(
    criteria(
      {
        ...analysis,
        criteria: [
          {
            ...analysis.criteria[0],
            category: 'ELIMINATORY',
            objectiveBasis: true,
            quote: 'CNH B obrigatória',
          },
        ],
      },
      'CNH B obrigatória',
    ).criteria[0].category,
  ).toBe('ELIMINATORY');
  expect(
    criteria({ ...analysis, criteria: [{ ...analysis.criteria[0], category: 'DECORATIVE' }] })
      .criteria[0].category,
  ).toBe('DECORATIVE');
});
it('rejects inconsistent evidence links', () => {
  for (const link of [
    { ...analysis.links[0], criterionId: 'x' },
    { ...analysis.links[0], experienceId: 'x' },
    { ...analysis.links[0], factIds: ['x'] },
    { ...analysis.links[0], experienceId: null },
    { ...analysis.links[0], factIds: [] },
    { ...analysis.links[0], status: 'unknown' },
  ])
    expect(() => criteria({ ...analysis, links: [link] })).toThrow('INVALID_REFERENCE');
  expect(
    criteria({
      ...analysis,
      links: [{ ...analysis.links[0], experienceId: null, factIds: [], status: 'unknown' }],
    }),
  ).toBeTruthy();
});
it('rejects all malformed primitive, array and closed object schema shapes', () => {
  for (const value of [2, null, [], true])
    expect(matches(value, { type: 'string', maxLength: 2 })).toBe(false);
  expect(matches(' ', { type: 'string', maxLength: 2 })).toBe(false);
  expect(matches('long', { type: 'string', maxLength: 2 })).toBe(false);
  expect(matches('x', { type: 'string', maxLength: 2, enum: ['y'] })).toBe(false);
  expect(matches('false', { type: 'boolean' })).toBe(false);
  expect(matches(false, { type: 'boolean' })).toBe(true);
  for (const value of ['1', 1.5, -1, 4])
    expect(matches(value, { type: 'integer', minimum: 0, maximum: 3 })).toBe(false);
  expect(matches(0, { type: 'integer', minimum: 0, maximum: 3 })).toBe(true);
  expect(matches([], { type: 'null' })).toBe(false);
  for (const value of [{}, [1, 2], ['bad']])
    expect(matches(value, { type: 'array', maxItems: 1, items: { type: 'boolean' } })).toBe(false);
  for (const value of [null, 1, [], { y: true }])
    expect(
      matches(value, { type: 'object', required: ['x'], properties: { x: { type: 'boolean' } } }),
    ).toBe(false);
  expect(matches({}, { type: 'unsupported' })).toBe(false);
});
import { createSession, prepare, validatePreparation } from './index';
it('validates the preparation boundary without accepting confirmed model facts', () => {
  const s = createSession('s', 'f', { resumes: 'r', job: 'j', objective: 'o', facts: 'f' });
  s.objective = { value: 'ENTER_FAST', provisional: false };
  s.sources = [source];
  const value = { version: 1, session: prepare(s, extraction, analysis) };
  expect(() => validatePreparation(value, 'Atendimento')).not.toThrow();
  for (const invalid of [
    null,
    1,
    { ...value, version: 2 },
    { ...value, session: null },
    { ...value, session: { ...value.session, version: 2 } },
    { ...value, session: { ...value.session, phase: 'writing' } },
    { ...value, session: { ...value.session, objective: null } },
    { ...value, session: { ...value.session, plan: null } },
    { ...value, session: { ...value.session, strategy: null } },
    ...['sources', 'facts', 'experiences', 'criteria', 'links'].map((key) => ({
      ...value,
      session: { ...value.session, [key]: null },
    })),
    {
      ...value,
      session: {
        ...value.session,
        facts: [{ ...value.session.facts[0], confirmation: 'confirmed' }],
      },
    },
    {
      ...value,
      session: {
        ...value.session,
        facts: [{ ...value.session.facts[0], externallyVerified: true }],
      },
    },
  ])
    expect(() => validatePreparation(invalid, 'Atendimento')).toThrow();
});

it('does not let the provider turn soft skills or preferences into elimination', () => {
  for (const quote of [
    'Proatividade obrigatória',
    'CNH B obrigatória, preferencialmente',
    'Experiência de 5 anos obrigatória',
  ])
    expect(
      criteria(
        {
          ...analysis,
          criteria: [
            { ...analysis.criteria[0], category: 'ELIMINATORY', objectiveBasis: true, quote },
          ],
        },
        quote,
      ).criteria[0].category,
    ).toBe('NEGOTIABLE');
});
