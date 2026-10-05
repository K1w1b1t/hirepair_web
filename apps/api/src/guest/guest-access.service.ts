import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_SECONDS = 60 * 60;

@Injectable()
export class GuestAccessService {
  issue(visitorId: string): { accessToken: string; expiresIn: number } {
    const payload = Buffer.from(
      JSON.stringify({ visitorId, exp: Date.now() + TOKEN_TTL_SECONDS * 1000 }),
    ).toString('base64url');
    return { accessToken: `${payload}.${this.signature(payload)}`, expiresIn: TOKEN_TTL_SECONDS };
  }

  verify(token: string): { visitorId: string } {
    const [payload, signature] = token.split('.');
    if (!payload || !signature || !this.validSignature(payload, signature))
      throw new UnauthorizedException();
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      visitorId?: string;
      exp?: number;
    };
    if (!parsed.visitorId || !parsed.exp || parsed.exp < Date.now())
      throw new UnauthorizedException();
    return { visitorId: parsed.visitorId };
  }

  private signature(payload: string): string {
    return createHmac('sha256', process.env.GUEST_ACCESS_SECRET ?? 'local-guest-access-secret')
      .update(payload)
      .digest('base64url');
  }
  private validSignature(payload: string, signature: string): boolean {
    const expected = Buffer.from(this.signature(payload));
    const supplied = Buffer.from(signature);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  }
}
