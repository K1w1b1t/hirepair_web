import { TurnstileService } from './turnstile.service';
import { OperationalModule } from '../operational/operational.module';
import { Module } from '@nestjs/common';
import { GuestAccessService } from './guest-access.service';
import { GuestAnalysisService } from './guest-analysis.service';
import { GuestController } from './guest.controller';
import { GuestQuotaService } from './guest-quota.service';
@Module({
  imports: [OperationalModule],
  controllers: [GuestController],
  providers: [GuestAccessService, GuestQuotaService, GuestAnalysisService, TurnstileService],
})
export class GuestModule {}
