import type { Params } from 'nestjs-pino';

export const PINO_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-access-token"]',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
];

export function buildPinoHttpOptions(isProduction: boolean): Params['pinoHttp'] {
  return {
    transport: isProduction ? undefined : { target: 'pino-pretty', options: { singleLine: true } },
    autoLogging: false,
    customProps: (request: object) => ({ traceId: (request as { traceId?: string }).traceId }),
    redact: { paths: PINO_REDACT_PATHS, censor: '[REDACTED]' },
  };
}
