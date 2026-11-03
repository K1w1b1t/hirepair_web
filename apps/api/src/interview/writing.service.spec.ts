import { WritingService } from './writing.service';
import { WritingController } from './writing.controller';
import { createSession, type Session } from '@hirepair/interview-engine';
function fixture() {
  const session = createSession('s', 'funnel', {
    resumes: 'r',
    job: 'j',
    objective: 'o',
    facts: 'f',
  });
  session.phase = 'ready';
  session.objective = { value: 'ENTER_FAST', provisional: false };
  const origin = { sourceId: 's', sourceVersion: 'v1', quote: 'Atendeu clientes' };
  session.facts = [
    {
      id: 'f',
      revision: 1,
      experienceId: 'e',
      storyId: null,
      text: origin.quote,
      origin,
      usable: true,
      confirmation: 'confirmed',
      externallyVerified: false,
    },
  ];
  session.experiences = [
    { id: 'e', title: 'Atendente', start: null, end: null, current: null, origin },
  ];
  session.confirmation = {
    id: 'c',
    version: 1,
    inputs: session.inputs,
    dependencies: [],
    valid: true,
    factIds: ['f'],
  };
  session.strategy = {
    id: 'strategy',
    version: 1,
    inputs: session.inputs,
    dependencies: [],
    valid: true,
    archetype: 'A_FIRST_JOB',
    tone: 'DIRECT',
    reason: 'Sintético',
    formula: 'CAR',
  };
  const content = {
    version: 1,
    explanation: 'Atendimento pertinente.',
    sections: [
      {
        id: 'exp',
        title: 'Experiência',
        experienceId: 'e',
        units: [{ id: 'b', text: 'Atendeu clientes', factIds: ['f'], criterionIds: [] }],
      },
    ],
  };
  return { version: 1 as const, session, targetRole: 'Atendente', content };
}
function request(body: ReturnType<typeof fixture>) {
  const { content, ...input } = body;
  void content;
  return input;
}
describe('bounded resume writing', () => {
  const ai = { estimateTokens: jest.fn(), generateText: jest.fn() };
  const quota = { reserveInterviewBlock: jest.fn(), finishAnalysis: jest.fn() };
  const access = { verify: jest.fn() };
  const service = () => new WritingService(ai as never, quota as never, access as never);
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.AI_PUBLIC_ENABLED = 'true';
    access.verify.mockReturnValue({ visitorId: 'v' });
    quota.reserveInterviewBlock.mockResolvedValue({ owner: 'lease' });
  });
  it('validates before reserving and returns grounded output', async () => {
    const body = fixture();
    body.session.criteria = [
      {
        id: 'criterion',
        text: 'Atendimento',
        kind: 'explicit',
        category: 'NEGOTIABLE',
        quote: 'Atendimento',
        reason: 'Relevância',
        evidenceNeeded: 'Exemplo',
        objectiveBasis: false,
        relevance: 1,
      },
    ];
    ai.generateText.mockResolvedValue({ text: JSON.stringify(body.content) });
    await expect(service().write('token', request(body), 'network', 'key')).resolves.toMatchObject({
      version: 1,
      revision: 0,
      content: body.content,
    });
    expect(quota.reserveInterviewBlock).toHaveBeenCalledWith(
      'v',
      'network',
      'key',
      expect.any(String),
    );
    expect(ai.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxAttempts: 1,
        maxOutputTokens: 3000,
        context: expect.objectContaining({ operation: 'resume-writing', scopeId: 's' }) as unknown,
      }),
    );
    expect(quota.finishAnalysis).toHaveBeenCalledWith({ owner: 'lease' }, true);
  });
  it.each([
    (s: Session) => {
      s.confirmation = null;
    },
    (s: Session) => {
      s.phase = 'interview';
    },
    (s: Session) => {
      s.strategy = null;
    },
    (s: Session) => {
      s.strategy!.inputs = { ...s.inputs, facts: 'old' };
    },
  ])('rejects unusable permission before spending', async (change) => {
    const body = fixture();
    change(body.session);
    await expect(service().write('token', request(body), 'network', 'key')).rejects.toHaveProperty(
      'status',
      400,
    );
    expect(ai.generateText).not.toHaveBeenCalled();
    expect(quota.reserveInterviewBlock).not.toHaveBeenCalled();
  });
  it.each([
    { version: 2 },
    { targetRole: '' },
    { targetRole: 3 },
    { targetRole: 'x'.repeat(201) },
    { session: null },
    { extra: 'x'.repeat(80001) },
  ])('rejects invalid payload %j', async (patch) => {
    await expect(
      service().write('token', { ...request(fixture()), ...patch } as never, 'network', 'key'),
    ).rejects.toHaveProperty('status', 400);
  });
  it('fails closed for invalid content and settles without success', async () => {
    ai.generateText.mockResolvedValue({ text: '{}' });
    await expect(
      service().write('token', request(fixture()), 'network', 'key'),
    ).rejects.toHaveProperty('status', 502);
    expect(quota.finishAnalysis).toHaveBeenCalledWith({ owner: 'lease' }, false);
  });
  it('preserves provider failure and never retries', async () => {
    ai.generateText.mockRejectedValue(new Error('unavailable'));
    await expect(service().write('token', request(fixture()), 'network', 'key')).rejects.toThrow(
      'unavailable',
    );
    expect(ai.generateText).toHaveBeenCalledTimes(1);
    expect(quota.finishAnalysis).toHaveBeenCalledWith({ owner: 'lease' }, false);
  });
  it('does not reserve when preflight refuses tokens', async () => {
    ai.estimateTokens.mockImplementation(() => {
      throw new Error('too large');
    });
    await expect(service().write('token', request(fixture()), 'network', 'key')).rejects.toThrow(
      'too large',
    );
    expect(quota.reserveInterviewBlock).not.toHaveBeenCalled();
  });
  it('controller requires guest authorization and idempotency', async () => {
    const write = jest.fn().mockResolvedValue({ version: 1 });
    const controller = new WritingController({ write } as never);
    const request = { socket: { remoteAddress: '127.0.0.1' }, headers: {} } as never;
    expect(() => controller.write(undefined, 'k', fixture(), request)).toThrow();
    expect(() => controller.write('Bearer a.b', undefined, fixture(), request)).toThrow();
    expect(() => controller.write('Bearer a.b', 'bad', fixture(), request)).toThrow();
    await expect(
      controller.write('Bearer a.b', 'k'.repeat(16), fixture(), request),
    ).resolves.toEqual({ version: 1 });
  });
});
it('returns essential evidence pending without publishing generated content', async () => {
  process.env.AI_PUBLIC_ENABLED = 'true';
  const body = fixture();
  const text = JSON.stringify({
    ...body.content,
    sections: [],
    pending: 'Esclarecer participação individual.',
  });
  const ai = { estimateTokens: jest.fn(), generateText: jest.fn().mockResolvedValue({ text }) };
  const quota = {
    reserveInterviewBlock: jest.fn().mockResolvedValue({ owner: 'pending' }),
    finishAnalysis: jest.fn(),
  };
  const service = new WritingService(
    ai as never,
    quota as never,
    { verify: () => ({ visitorId: 'v' }) } as never,
  );
  await expect(service.write('token', request(body), 'network', 'key')).resolves.toMatchObject({
    version: 1,
    pending: { reason: 'Esclarecer participação individual.' },
  });
  expect(quota.finishAnalysis).toHaveBeenCalledWith({ owner: 'pending' }, true);
});
it.each([
  { version: 2 },
  { id: '' },
  { id: 3 },
  { id: 'x'.repeat(101) },
  { funnelSessionId: '' },
  { funnelSessionId: 3 },
  { funnelSessionId: 'x'.repeat(101) },
  { revision: -1 },
  { revision: 0.5 },
])('rejects malformed v1 writing identity %j before reserving', async (patch) => {
  process.env.AI_PUBLIC_ENABLED = 'true';
  const body = request(fixture());
  Object.assign(body.session, patch);
  const ai = { estimateTokens: jest.fn(), generateText: jest.fn() };
  const quota = { reserveInterviewBlock: jest.fn() };
  const service = new WritingService(
    ai as never,
    quota as never,
    { verify: () => ({ visitorId: 'v' }) } as never,
  );
  await expect(service.write('token', body, 'network', 'key')).rejects.toHaveProperty(
    'status',
    400,
  );
  expect(quota.reserveInterviewBlock).not.toHaveBeenCalled();
});
