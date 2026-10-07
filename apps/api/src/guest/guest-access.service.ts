import { Injectable } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  appEnvironment,
  guestSecret,
  LEGAL_VERSION,
  operationalError,
  RECORD_TTL_MS,
} from '../operational/operational.config';

interface GuestClaims {
  visitorId: string;
  purpose: 'access' | 'credential';
  environment: string;
  exp: number;
  termsVersion: string;
  privacyVersion: string;
}
@Injectable()
export class GuestAccessService {
  issue(credential?: string): { accessToken: string; guestCredential: string; expiresIn: number } {
    const visitorId = credential
      ? this.read(credential, 'credential', false).visitorId
      : randomUUID();
    return {
      accessToken: this.sign(visitorId, 'access', 3_600_000),
      guestCredential: this.sign(visitorId, 'credential', RECORD_TTL_MS),
      expiresIn: 3600,
    };
  }
  verify(token: string): { visitorId: string } {
    return { visitorId: this.read(token, 'access', true).visitorId };
  }
  private sign(visitorId: string, purpose: GuestClaims['purpose'], ttl: number): string {
    const claims: GuestClaims = {
      visitorId,
      purpose,
      environment: appEnvironment(),
      exp: Date.now() + ttl,
      termsVersion: LEGAL_VERSION,
      privacyVersion: LEGAL_VERSION,
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `${payload}.${this.signature(payload)}`;
  }
  private read(
    token: string,
    purpose: GuestClaims['purpose'],
    currentConsent: boolean,
  ): GuestClaims {
    try {
      if (token.length > 2048) throw new Error();
      const parts = token.split('.');
      if (parts.length !== 2) throw new Error();
      const [payload, signature] = parts;
      const supplied = Buffer.from(signature);
      const expected = Buffer.from(this.signature(payload));
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
        throw new Error();
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as GuestClaims;
      if (
        !/^[0-9a-f-]{36}$/.test(parsed.visitorId) ||
        parsed.purpose !== purpose ||
        parsed.environment !== appEnvironment() ||
        !Number.isFinite(parsed.exp) ||
        parsed.exp <= Date.now() ||
        (currentConsent &&
          (parsed.termsVersion !== LEGAL_VERSION || parsed.privacyVersion !== LEGAL_VERSION))
      )
        throw new Error();
      return parsed;
    } catch {
      throw operationalError('GUEST_ACCESS_INVALID', 401);
    }
  }
  private signature(payload: string): string {
    return createHmac('sha256', guestSecret()).update(payload).digest('base64url');
  }
}
