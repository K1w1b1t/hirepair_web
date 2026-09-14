import { Injectable, Logger, OnApplicationShutdown, OnModuleInit, Optional } from '@nestjs/common';
import { Job, JobsOptions, Queue, Worker } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { DiscordService } from '../common/discord/discord.service';
import {
  REQUEST_CONTEXT_KEYS,
  SYSTEM_ACTOR_ID,
} from '../common/request-context/request-context.constants';
import {
  AUDIO_PROCESSING_JOB,
  AUDIO_PROCESSING_QUEUE,
  PDF_GENERATION_JOB,
  PDF_GENERATION_QUEUE,
} from './queues.constants';
import { AudioProcessingJobData, CorrelatedJobData, PdfGenerationJobData } from './queues.types';

interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
  maxRetriesPerRequest: null;
}
const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
};

@Injectable()
export class QueuesService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(QueuesService.name);
  private readonly connection: RedisConnectionOptions;
  private readonly audioQueue: Queue<AudioProcessingJobData>;
  private readonly pdfQueue: Queue<PdfGenerationJobData>;
  private audioWorker?: Worker<AudioProcessingJobData>;
  private pdfWorker?: Worker<PdfGenerationJobData>;
  constructor(
    @Optional() private readonly cls?: ClsService,
    @Optional() private readonly discord?: DiscordService,
  ) {
    this.connection = this.createConnection();
    this.audioQueue = new Queue(AUDIO_PROCESSING_QUEUE, {
      connection: this.connection,
      defaultJobOptions,
    });
    this.pdfQueue = new Queue(PDF_GENERATION_QUEUE, {
      connection: this.connection,
      defaultJobOptions,
    });
  }
  onModuleInit(): void {
    this.audioWorker = this.createWorker(AUDIO_PROCESSING_QUEUE, (job) => this.processAudio(job));
    this.pdfWorker = this.createWorker(PDF_GENERATION_QUEUE, (job) => this.processPdf(job));
  }
  enqueueAudioProcessing(data: AudioProcessingJobData): Promise<Job<AudioProcessingJobData>> {
    return this.audioQueue.add(AUDIO_PROCESSING_JOB, this.withTrace(data));
  }
  enqueuePdfGeneration(data: PdfGenerationJobData): Promise<Job<PdfGenerationJobData>> {
    return this.pdfQueue.add(PDF_GENERATION_JOB, this.withTrace(data));
  }
  async onApplicationShutdown(): Promise<void> {
    await Promise.all([
      this.audioWorker?.close(),
      this.pdfWorker?.close(),
      this.audioQueue.close(),
      this.pdfQueue.close(),
    ]);
  }
  private withTrace<T extends CorrelatedJobData>(data: T): T {
    const correlationId = this.cls?.get<string | undefined>(REQUEST_CONTEXT_KEYS.GLOBAL_TRACE_ID);
    return correlationId ? { ...data, correlationId } : data;
  }
  private createConnection(): RedisConnectionOptions {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl)
      return {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        maxRetriesPerRequest: null,
      };
    const url = new URL(redisUrl);
    if (!['redis:', 'rediss:'].includes(url.protocol))
      throw new Error('REDIS_URL deve usar o protocolo redis:// ou rediss://.');
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
    };
  }
  private createWorker<T extends CorrelatedJobData>(
    queueName: string,
    handler: (job: Job<T>) => Promise<void>,
  ): Worker<T> {
    const worker = new Worker<T>(queueName, (job) => this.inJobContext(job, handler), {
      connection: this.connection,
    });
    worker.on('completed', (job) =>
      this.logger.log({
        msg: 'Job completed',
        queue: queueName,
        jobId: job.id,
        traceId: job.data.correlationId,
      }),
    );
    worker.on('failed', (job, error) => {
      this.logger.error({
        msg: 'Job failed',
        queue: queueName,
        jobId: job?.id,
        traceId: job?.data.correlationId,
        errorType: error.constructor.name,
      });
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1))
        void this.discord?.sendJobFailure({
          queue: queueName,
          jobId: job.id,
          jobName: job.name,
          traceId: job.data.correlationId,
          failedReason: error.message,
        });
    });
    return worker;
  }
  private async inJobContext<T extends CorrelatedJobData>(
    job: Job<T>,
    handler: (job: Job<T>) => Promise<void>,
  ): Promise<void> {
    if (!this.cls) return handler(job);
    return this.cls.run(async () => {
      this.cls?.set(REQUEST_CONTEXT_KEYS.ACTOR_ID, SYSTEM_ACTOR_ID);
      if (job.data.correlationId)
        this.cls?.set(REQUEST_CONTEXT_KEYS.GLOBAL_TRACE_ID, job.data.correlationId);
      await handler(job);
    });
  }
  private processAudio(job: Job<AudioProcessingJobData>): Promise<void> {
    this.logger.log({
      msg: 'Processing audio',
      applicationId: job.data.applicationId,
      traceId: job.data.correlationId,
    });
    return Promise.resolve();
  }
  private processPdf(job: Job<PdfGenerationJobData>): Promise<void> {
    this.logger.log({
      msg: 'Generating PDF',
      resumeId: job.data.resumeId,
      traceId: job.data.correlationId,
    });
    return Promise.resolve();
  }
}
