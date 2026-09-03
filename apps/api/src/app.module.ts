import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueuesModule } from './queues/queues.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // O `.env` deste monorepo vive na raiz; `apps/api/.env` e opcional e, se
      // existir, sobrepoe (o primeiro arquivo a definir a variavel ganha).
      envFilePath: ['.env', '../../.env'],
      validate,
    }),
    PrismaModule,
    QueuesModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
