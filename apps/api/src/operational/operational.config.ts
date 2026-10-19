import { HttpException } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';

export const LEGAL_VERSION = '2026-10-07';
export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;
export const RECORD_TTL_MS = 30 * DAY_MS;
export const appEnvironment = () => process.env.APP_ENV ?? 'development';
export function guestSecret(): string {
  const secret = process.env.GUEST_ACCESS_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32)
    throw new Error('GUEST_ACCESS_SECRET deve ter pelo menos 32 bytes.');
  return secret;
}
export function opaqueId(value: string): string {
  return createHmac('sha256', guestSecret()).update(value).digest('hex');
}
export function operationalError(
  code: string,
  status = 503,
  retryAfterSeconds?: number,
): HttpException {
  return new HttpException(
    {
      statusCode: status,
      code,
      message: code,
      traceId: randomUUID(),
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    },
    status,
  );
}
export function requirePublicAi(): void {
  if (process.env.AI_PUBLIC_ENABLED !== 'true') throw operationalError('AI_DISABLED');
}
