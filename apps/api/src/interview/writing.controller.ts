import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { clientNetwork } from '../operational/client-ip';
import { operationalError } from '../operational/operational.config';
import { WritingService, type WritingRequest } from './writing.service';
@Controller('guest')
export class WritingController {
  constructor(private readonly writing: WritingService) {}
  @Post('resume-writing')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  write(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: WritingRequest,
    @Req() request: Request,
  ) {
    const token = authorization?.match(/^Bearer ([a-z0-9_-]+\.[a-z0-9_-]+)$/i)?.[1];
    if (!token) throw operationalError('GUEST_ACCESS_INVALID', 401);
    if (!key || !/^[A-Za-z0-9_-]{16,100}$/.test(key))
      throw operationalError('IDEMPOTENCY_KEY_REQUIRED', 400);
    return this.writing.write(token, body, clientNetwork(request), key);
  }
}
