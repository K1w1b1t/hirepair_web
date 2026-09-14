import { buildPinoHttpOptions, PINO_REDACT_PATHS } from './pino-http.config';

describe('buildPinoHttpOptions', () => {
  it('redacts credentials and emits JSON in production', () => {
    const options = buildPinoHttpOptions(true) as Record<string, unknown>;

    expect(options.transport).toBeUndefined();
    expect(options.autoLogging).toBe(false);
    expect(PINO_REDACT_PATHS).toContain('req.headers.authorization');
    expect(options.redact).toEqual(
      expect.objectContaining({ censor: '[REDACTED]', paths: PINO_REDACT_PATHS }),
    );
  });

  it('uses the readable development transport and binds the trace', () => {
    const options = buildPinoHttpOptions(false) as {
      transport: unknown;
      customProps: (request: object) => object;
    };

    expect(options.transport).toBeDefined();
    expect(options.customProps({ traceId: 'trace-1' })).toEqual({ traceId: 'trace-1' });
  });
});
