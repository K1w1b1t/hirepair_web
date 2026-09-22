import { Injectable, Logger, Optional, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Error500Payload {
  traceId?: string;
  method: string;
  path: string;
  route: string;
  errorMessage: string;
  stack?: string;
}
export interface JobFailurePayload {
  queue: string;
  jobId?: string;
  jobName?: string;
  failedReason?: string;
  traceId?: string;
}
const COOLDOWN_MS = 5 * 60_000;
const MAX_KEYS = 5_000;

@Injectable()
export class DiscordService implements OnModuleInit {
  private readonly logger = new Logger(DiscordService.name);
  private webhookUrl?: string;
  private readonly lastSentAt = new Map<string, number>();
  constructor(
    private readonly config: ConfigService,
    @Optional()
    private readonly now: () => number = () => Date.now(),
  ) {}
  onModuleInit(): void {
    this.webhookUrl = this.config.get<string>('DISCORD_WEBHOOK_URL');
    if (!this.webhookUrl)
      this.logger.warn('DISCORD_WEBHOOK_URL nao configurada — alertas desativados.');
  }
  async sendError500(payload: Error500Payload): Promise<void> {
    await this.send(`500:${payload.method}:${payload.route}`, {
      title: 'HirePair API — erro 500',
      color: 0xe74c3c,
      timestamp: new Date().toISOString(),
      fields: [
        { name: 'Request', value: `${payload.method} ${payload.path}` },
        { name: 'Trace ID', value: payload.traceId ?? 'N/A' },
        { name: 'Ambiente', value: this.config.get<string>('NODE_ENV', 'unknown') },
        { name: 'Erro', value: payload.errorMessage.slice(0, 1000) },
        ...(payload.stack ? [{ name: 'Stack', value: this.truncate(payload.stack) }] : []),
      ],
    });
  }
  async sendJobFailure(payload: JobFailurePayload): Promise<void> {
    await this.send(`job:${payload.queue}:${payload.jobId ?? payload.jobName ?? 'unknown'}`, {
      title: 'HirePair API — job esgotou tentativas',
      color: 0xe74c3c,
      timestamp: new Date().toISOString(),
      fields: [
        { name: 'Fila', value: payload.queue },
        { name: 'Job', value: payload.jobId ?? payload.jobName ?? 'N/A' },
        { name: 'Trace ID', value: payload.traceId ?? 'N/A' },
        { name: 'Erro', value: this.truncate(payload.failedReason) || 'N/A' },
      ],
    });
  }
  private async send(key: string, embed: unknown): Promise<void> {
    if (!this.webhookUrl || this.isLimited(key)) return;
    this.mark(key);
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
      if (!response.ok) this.logger.warn(`Discord respondeu HTTP ${response.status}.`);
    } catch (caught) {
      this.logger.error(
        `Falha ao enviar alerta Discord: ${caught instanceof Error ? caught.message : String(caught)}`,
      );
    }
  }
  private isLimited(key: string): boolean {
    const sentAt = this.lastSentAt.get(key);
    return sentAt !== undefined && this.now() - sentAt < COOLDOWN_MS;
  }
  private mark(key: string): void {
    const now = this.now();
    for (const [entry, sentAt] of this.lastSentAt)
      if (now - sentAt >= COOLDOWN_MS) this.lastSentAt.delete(entry);
    if (this.lastSentAt.size >= MAX_KEYS) this.lastSentAt.clear();
    this.lastSentAt.set(key, now);
  }
  private truncate(value?: string): string | undefined {
    return value && value.length > 1000 ? `...${value.slice(-1000)}` : value;
  }
}
