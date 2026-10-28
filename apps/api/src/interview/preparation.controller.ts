import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { IsBoolean, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { OBJECTIVES, type Objective } from '@hirepair/interview-engine';
import { GuestAnalysisDto } from '../guest/guest.controller';
import { operationalError } from '../operational/operational.config';
import { clientNetwork } from '../operational/client-ip';
import { PreparationService } from './preparation.service';
export class PreparationDto extends GuestAnalysisDto {
  @IsIn([1]) version!: 1;
  @IsString() @MinLength(1) @MaxLength(100) sessionId!: string;
  @IsString() @MinLength(1) @MaxLength(100) funnelSessionId!: string;
  @IsIn(OBJECTIVES) objective!: Objective;
  @IsBoolean() provisional!: boolean;
}
@Controller('guest')
export class PreparationController {
  constructor(private readonly preparation: PreparationService) {}
  @Post('interview-preparation')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  prepare(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: PreparationDto,
    @Req() request: Request,
  ) {
    const token = authorization?.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i)?.[1];
    if (!token) throw operationalError('GUEST_ACCESS_INVALID', 401);
    if (!key || !/^[A-Za-z0-9_-]{16,100}$/.test(key))
      throw operationalError('IDEMPOTENCY_KEY_REQUIRED', 400);
    return this.preparation.prepare(token, body, clientNetwork(request), key);
  }
}
