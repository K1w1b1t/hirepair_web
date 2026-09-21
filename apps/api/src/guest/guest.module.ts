import { Module } from '@nestjs/common';
import { GuestAccessService } from './guest-access.service';
import { GuestAnalysisService } from './guest-analysis.service';
import { GuestController } from './guest.controller';
import { GuestQuotaService } from './guest-quota.service';
@Module({
  controllers: [GuestController],
  providers: [GuestAccessService, GuestQuotaService, GuestAnalysisService],
})
export class GuestModule {}
