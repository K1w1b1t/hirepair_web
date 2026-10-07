import { Injectable } from '@nestjs/common';
import { parseCorsOrigins } from '../config/http-config';
import { operationalError } from '../operational/operational.config';

@Injectable()
export class TurnstileService {
  async verify(token: string): Promise<void> {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) throw operationalError('TURNSTILE_UNAVAILABLE');
    let result: { success?: boolean; hostname?: string; action?: string };
    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret, response: token }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error();
      result = (await response.json()) as typeof result;
    } catch {
      throw operationalError('TURNSTILE_UNAVAILABLE');
    }
    const hosts = parseCorsOrigins(process.env.CORS_ORIGIN).map(
      (origin) => new URL(origin).hostname,
    );
    if (
      result?.success !== true ||
      !hosts.includes(result.hostname ?? '') ||
      result.action !== 'guest_access'
    )
      throw operationalError('TURNSTILE_INVALID', 400);
  }
}
