import { Queue, Worker } from 'bullmq';
import { AUDIO_PROCESSING_QUEUE, PDF_GENERATION_QUEUE } from './queues.constants';
import { QueuesService } from './queues.service';

jest.mock('bullmq', () => ({
  Queue: jest.fn(),
  Worker: jest.fn(),
}));

const QueueMock = Queue as unknown as jest.Mock;
const WorkerMock = Worker as unknown as jest.Mock;

interface QueuesServiceInternals {
  connection: {
    host: string;
    port: number;
    password?: string;
    tls?: Record<string, never>;
    maxRetriesPerRequest: null;
  };
}

describe('QueuesService', () => {
  const close = jest.fn().mockResolvedValue(undefined);
  const add = jest.fn().mockResolvedValue({ id: 'job-1' });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    QueueMock.mockImplementation(() => ({ add, close }));
    WorkerMock.mockImplementation(() => ({ close, on: jest.fn() }));
  });

  it('usa o Redis local por padrao e registra as duas filas', () => {
    const service = new QueuesService();
    const { connection } = service as unknown as QueuesServiceInternals;

    expect(connection).toEqual({ host: 'localhost', port: 6379, maxRetriesPerRequest: null });
    expect(QueueMock).toHaveBeenCalledWith(AUDIO_PROCESSING_QUEUE, expect.any(Object));
    expect(QueueMock).toHaveBeenCalledWith(PDF_GENERATION_QUEUE, expect.any(Object));
  });

  it('interpreta URL TLS do Upstash e cria workers no boot', () => {
    process.env.REDIS_URL = 'rediss://default:secret@sa-east-1.upstash.io:6379';
    const service = new QueuesService();
    const { connection } = service as unknown as QueuesServiceInternals;

    service.onModuleInit();

    expect(connection).toEqual({
      host: 'sa-east-1.upstash.io',
      port: 6379,
      username: 'default',
      password: 'secret',
      tls: {},
      maxRetriesPerRequest: null,
    });
    expect(WorkerMock).toHaveBeenCalledTimes(2);
  });

  it('enfileira os jobs com payload minimo', async () => {
    const service = new QueuesService();

    await service.enqueueAudioProcessing({ applicationId: 'application-1' });
    await service.enqueuePdfGeneration({ resumeId: 'resume-1' });

    expect(add).toHaveBeenCalledWith('transcribe-audio', { applicationId: 'application-1' });
    expect(add).toHaveBeenCalledWith('generate-pdf', { resumeId: 'resume-1' });
  });
});
