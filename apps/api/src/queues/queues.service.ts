import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Job, JobsOptions, Queue, Worker } from 'bullmq';
import {
  AUDIO_PROCESSING_JOB,
  AUDIO_PROCESSING_QUEUE,
  PDF_GENERATION_JOB,
  PDF_GENERATION_QUEUE,
} from './queues.constants';
import { AudioProcessingJobData, PdfGenerationJobData } from './queues.types';

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

  constructor() {
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
    this.audioWorker = this.createWorker(AUDIO_PROCESSING_QUEUE, async (job) =>
      this.processAudio(job),
    );
    this.pdfWorker = this.createWorker(PDF_GENERATION_QUEUE, async (job) => this.processPdf(job));
  }

  async enqueueAudioProcessing(data: AudioProcessingJobData): Promise<Job<AudioProcessingJobData>> {
    return this.audioQueue.add(AUDIO_PROCESSING_JOB, data);
  }

  async enqueuePdfGeneration(data: PdfGenerationJobData): Promise<Job<PdfGenerationJobData>> {
    return this.pdfQueue.add(PDF_GENERATION_JOB, data);
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([
      this.audioWorker?.close(),
      this.pdfWorker?.close(),
      this.audioQueue.close(),
      this.pdfQueue.close(),
    ]);
  }

  private createConnection(): RedisConnectionOptions {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: (process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined) ?? 6379,
        maxRetriesPerRequest: null,
      };
    }

    const url = new URL(redisUrl);
    if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
      throw new Error('REDIS_URL deve usar o protocolo redis:// ou rediss://.');
    }

    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 6379,
      ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
    };
  }

  private createWorker<T>(queueName: string, processor: (job: Job<T>) => Promise<void>): Worker<T> {
    const worker = new Worker<T>(queueName, processor, { connection: this.connection });
    worker.on('completed', (job) =>
      this.logger.log(`Job ${job.id ?? 'sem-id'} concluído em ${queueName}.`),
    );
    worker.on('failed', (job, error) =>
      this.logger.error(`Job ${job?.id ?? 'sem-id'} falhou em ${queueName}.`, error.stack),
    );
    return worker;
  }

  private processAudio(job: Job<AudioProcessingJobData>): Promise<void> {
    this.logger.log(`Processando áudio da candidatura ${job.data.applicationId}.`);
    return Promise.resolve();
  }

  private processPdf(job: Job<PdfGenerationJobData>): Promise<void> {
    this.logger.log(`Gerando PDF do currículo ${job.data.resumeId}.`);
    return Promise.resolve();
  }
}
