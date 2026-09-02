import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

// Nao importa PrismaModule: ele e @Global(), basta injetar PrismaService.
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
