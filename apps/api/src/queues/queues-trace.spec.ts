import { Queue, Worker } from 'bullmq';
import { QueuesService } from './queues.service';

jest.mock('bullmq', () => ({ Queue: jest.fn(), Worker: jest.fn() }));

describe('QueuesService trace context', () => {
  it('adds the trace to jobs and restores it in a fresh worker CLS context', async () => {
    const add = jest.fn().mockResolvedValue({ id: '1' });
    (Queue as unknown as jest.Mock).mockImplementation(() => ({ add, close: jest.fn() }));
    let processor: ((job: object) => Promise<void>) | undefined;
    (Worker as unknown as jest.Mock).mockImplementation((_name: string, handler: unknown) => {
      processor = handler as (job: object) => Promise<void>;
      return { on: jest.fn(), close: jest.fn() };
    });
    const set = jest.fn();
    const cls = { get: () => 'trace-1', run: (callback: () => Promise<void>) => callback(), set };
    const service = new QueuesService(cls as never);
    await service.enqueueAudioProcessing({ applicationId: 'app-1' });
    expect(add).toHaveBeenCalledWith('transcribe-audio', {
      applicationId: 'app-1',
      correlationId: 'trace-1',
    });
    service.onModuleInit();
    await processor?.({ data: { applicationId: 'app-1', correlationId: 'trace-1' } });
    expect(set).toHaveBeenCalledWith('globalTraceId', 'trace-1');
  });
});
