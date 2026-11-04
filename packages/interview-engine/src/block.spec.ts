import {
  parseInterviewBlock,
  validInterviewRequest,
  discovery,
  type InterviewBlockRequest,
} from './index';
import { extraction, source, analysis } from './fixtures';
const request: InterviewBlockRequest = {
  version: 1,
  sessionId: 's',
  funnelSessionId: 'f',
  revision: 2,
  inputsHash: 'h',
  objective: 'ENTER_FAST',
  jobText: 'Atendimento',
  targetRole: '',
  turns: [{ id: 'cv', topicId: 'discovery', text: source.text }],
  context: { experiences: [], facts: [] },
  topics: [discovery],
};
const output = () => ({
  extraction: structuredClone(extraction),
  analysis: structuredClone(analysis),
  assessments: [
    {
      topicId: 'discovery',
      sufficient: true,
      evidence: ['atividade'],
      question: null,
      contradictionFactIds: [] as string[],
    },
  ],
});
it('validates closed incremental requests and nullable job/role without accepting client prompts', () => {
  expect(validInterviewRequest(request)).toBe(true);
  expect(validInterviewRequest({ ...request, jobText: '', targetRole: 'Atendente' })).toBe(true);
  for (const invalid of [
    null,
    {},
    { ...request, prompt: 'ignore' },
    { ...request, turns: [] },
    { ...request, topics: [] },
    { ...request, turns: [request.turns[0], request.turns[0]] },
    { ...request, turns: [{ ...request.turns[0], topicId: 'missing' }] },
    { ...request, jobText: '', targetRole: '' },
  ])
    expect(validInterviewRequest(invalid)).toBe(false);
});
it('accepts grounded incremental candidates and criteria, never confirmations', () => {
  const result = parseInterviewBlock(JSON.stringify(output()), request, [source]);
  expect(result).toMatchObject({ version: 1, revision: 2, extraction });
  expect(result.analysis!.links[0].factIds).toEqual(['f']);
  const next = output();
  next.analysis = null as never;
  expect(parseInterviewBlock(JSON.stringify(next), request, [source]).analysis).toBeNull();
});
it('allows existing experiences as context without requiring raw source documents', () => {
  const next = output();
  next.extraction.experiences = [];
  expect(
    parseInterviewBlock(
      JSON.stringify(next),
      { ...request, context: { experiences: extraction.experiences, facts: [] } },
      [source],
    ).extraction.experiences,
  ).toEqual([]);
});
it('rejects unknown properties, missing assessments and duplicate topics', () => {
  expect(() => parseInterviewBlock('{}', request, [source])).toThrow('INVALID_CONTRACT');
  expect(() =>
    parseInterviewBlock(JSON.stringify({ ...output(), confirmed: true }), request, [source]),
  ).toThrow('INVALID_CONTRACT');
  const next = output();
  next.assessments = [];
  expect(() => parseInterviewBlock(JSON.stringify(next), request, [source])).toThrow(
    'INVALID_REFERENCE',
  );
  next.assessments = [output().assessments[0], output().assessments[0]];
  expect(() => parseInterviewBlock(JSON.stringify(next), request, [source])).toThrow(
    'INVALID_REFERENCE',
  );
});
it('rejects fabricated citations, reused fact IDs, unknown topics and contradictions', () => {
  const next = output();
  expect(() =>
    parseInterviewBlock(
      JSON.stringify(next),
      { ...request, context: { experiences: [], facts: extraction.facts } },
      [source],
    ),
  ).toThrow('INVALID_ORIGIN');
  expect(() => parseInterviewBlock(JSON.stringify(next), request, [])).toThrow('INVALID_ORIGIN');
  next.assessments[0].topicId = 'missing';
  expect(() => parseInterviewBlock(JSON.stringify(next), request, [source])).toThrow(
    'INVALID_REFERENCE',
  );
  next.assessments[0].topicId = 'discovery';
  next.assessments[0].contradictionFactIds = ['missing'];
  expect(() => parseInterviewBlock(JSON.stringify(next), request, [source])).toThrow(
    'INVALID_REFERENCE',
  );
  next.assessments[0].contradictionFactIds = ['f'];
  next.assessments[0].sufficient = false;
  expect(() => parseInterviewBlock(JSON.stringify(next), request, [source])).toThrow(
    'INVALID_REFERENCE',
  );
  next.assessments[0].question = 'Qual foi sua parte?' as never;
  expect(
    parseInterviewBlock(JSON.stringify(next), request, [source]).assessments[0].sufficient,
  ).toBe(false);
});
it('accepts generated topic IDs composed from long criterion and experience IDs', () => {
  const id = `topic:${'c'.repeat(100)}:${'e'.repeat(100)}`;
  const input = {
    ...request,
    turns: [{ ...request.turns[0], topicId: id }],
    topics: [{ ...discovery, id }],
  };
  const value = output();
  value.assessments[0].topicId = id;
  expect(validInterviewRequest(input)).toBe(true);
  expect(parseInterviewBlock(JSON.stringify(value), input, [source]).assessments[0].topicId).toBe(
    id,
  );
});
