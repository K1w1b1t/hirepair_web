import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { DiscordModule } from '../common/discord/discord.module';
import { AiBudgetService } from './ai-budget.service';
@Global()
@Module({
  imports: [DiscordModule],
  providers: [RedisService, RedisThrottlerStorage, AiBudgetService],
  exports: [RedisService, RedisThrottlerStorage, AiBudgetService],
})
export class OperationalModule {}
