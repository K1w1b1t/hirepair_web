import { Body, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { GuestAccessService } from './guest-access.service';
import { GuestAnalysisService } from './guest-analysis.service';
import { GuestQuotaService } from './guest-quota.service';
import { TurnstileService } from './turnstile.service';
import {
  LEGAL_VERSION,
  operationalError,
  requirePublicAi,
} from '../operational/operational.config';
import { clientNetwork } from '../operational/client-ip';
import type { GuestAnalysisResponse } from './guest.types';

export class GuestAccessDto {
  @IsOptional() @IsString() @MaxLength(2048) guestCredential?: string;
  @IsString() @MinLength(1) @MaxLength(2048) turnstileToken!: string;
  @IsBoolean() acceptedTerms!: boolean;
  @IsBoolean() acceptedPrivacy!: boolean;
  @IsString() @MaxLength(32) termsVersion!: string;
  @IsString() @MaxLength(32) privacyVersion!: string;
}
class GuestDocumentDto {
  @IsString() @MaxLength(100) id!: string;
  @IsString() @MaxLength(20_000) text!: string;
}
export class GuestAnalysisDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => GuestDocumentDto)
  documents!: GuestDocumentDto[];
  @IsOptional() @IsString() @MaxLength(20_000) jobText?: string;
  @IsOptional() @IsString() @MaxLength(200) targetRole?: string;
}
@Controller('guest')
export class GuestController {
  constructor(
    private readonly access: GuestAccessService,
    private readonly analysis: GuestAnalysisService,
    private readonly quota: GuestQuotaService,
    private readonly turnstile: TurnstileService,
  ) {}
  @Get('config') config() {
    return {
      enabled: process.env.AI_PUBLIC_ENABLED === 'true',
      siteKey: process.env.TURNSTILE_SITE_KEY ?? '',
      termsVersion: LEGAL_VERSION,
      privacyVersion: LEGAL_VERSION,
    };
  }
  @Post('access')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async accessToken(@Body() body: GuestAccessDto, @Req() request: Request) {
    requirePublicAi();
    if (
      body.acceptedTerms !== true ||
      body.acceptedPrivacy !== true ||
      body.termsVersion !== LEGAL_VERSION ||
      body.privacyVersion !== LEGAL_VERSION
    )
      throw operationalError('CONSENT_REQUIRED', 400);
    await this.quota.reserveAccess(clientNetwork(request));
    await this.turnstile.verify(body.turnstileToken);
    const issued = this.access.issue(body.guestCredential);
    await this.quota.recordConsent(this.access.verify(issued.accessToken).visitorId);
    return issued;
  }
  @Post('job-analysis')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  analyze(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: GuestAnalysisDto,
    @Req() request: Request,
  ): Promise<GuestAnalysisResponse> {
    const token = authorization?.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i)?.[1];
    if (!token) throw operationalError('GUEST_ACCESS_INVALID', 401);
    if (!key || !/^[A-Za-z0-9_-]{16,100}$/.test(key))
      throw operationalError('IDEMPOTENCY_KEY_REQUIRED', 400);
    return this.analysis.analyze(token, body, clientNetwork(request), key);
  }
}
