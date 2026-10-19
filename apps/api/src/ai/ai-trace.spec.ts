import { AiService } from './ai.service';
describe('AiService request boundary', () => {
  it('requires the business budget even if provider credentials exist', async () => {
    process.env.AI_PUBLIC_ENABLED = 'true';
    process.env.GROQ_API_KEY = 'key';
    const reserve = jest.fn().mockRejectedValue(new Error('budget denied'));
    const service = new AiService(undefined, undefined, { reserve } as never);
    await expect(
      service.generateText({
        prompt: 'test',
        responseSchema: {},
        context: {
          principalId: 'v',
          scopeId: 'v',
          operation: 'job-analysis',
          idempotencyKey: 'key',
          inputVersion: 'hash',
        },
      }),
    ).rejects.toThrow('budget denied');
  });
});
