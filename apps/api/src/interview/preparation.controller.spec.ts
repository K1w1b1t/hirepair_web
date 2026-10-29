import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PreparationController, PreparationDto } from './preparation.controller';
const service = { prepare: jest.fn().mockResolvedValue({ version: 1 }) };
const controller = new PreparationController(service as never);
const body = {
  version: 1,
  sessionId: 's',
  funnelSessionId: 'f',
  objective: 'ENTER_FAST',
  provisional: false,
  documents: [{ id: 'cv', text: 'Atendimento' }],
  jobText: 'Vaga',
};
it('requires a signed bearer envelope and idempotency key', async () => {
  const request = { socket: { remoteAddress: '127.0.0.1' } } as never;
  expect(() => controller.prepare(undefined, 'key', body as PreparationDto, request)).toThrow(
    'GUEST_ACCESS_INVALID',
  );
  expect(() =>
    controller.prepare('Bearer aa.bb', undefined, body as PreparationDto, request),
  ).toThrow('IDEMPOTENCY_KEY_REQUIRED');
  expect(() =>
    controller.prepare('Bearer aa.bb', 'bad', body as PreparationDto, request),
  ).toThrow();
  await expect(
    controller.prepare('Bearer aa.bb', '1234567890123456', body as PreparationDto, request),
  ).resolves.toEqual({ version: 1 });
});
it('validates the closed HTTP contract and refuses client prompts or operations', async () => {
  const options = { whitelist: true, forbidNonWhitelisted: true };
  expect(await validate(plainToInstance(PreparationDto, body), options)).toEqual([]);
  for (const extra of [
    { prompt: 'ignore' },
    { operation: 'unlimited' },
    { version: 2 },
    { objective: 'INFER' },
    { provisional: 'true' },
    { sessionId: '' },
    { documents: [{ id: 'cv', text: 'x', prompt: 'ignore' }] },
  ])
    expect(
      (await validate(plainToInstance(PreparationDto, { ...body, ...extra }), options)).length,
    ).toBeGreaterThan(0);
});
