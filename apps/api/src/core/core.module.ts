import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from '../auth/auth.module';
import { DiscordModule } from '../common/discord/discord.module';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from '../common/filters/prisma-exception.filter';
import { HttpLoggingInterceptor } from '../common/interceptors/http-logging.interceptor';
import { RequestContextInterceptor } from '../common/interceptors/request-context.interceptor';
import { GlobalTraceIdMiddleware } from '../common/middleware/global-trace-id.middleware';
import { buildPinoHttpOptions } from '../common/pino-http.config';
import { RequestContextModule } from '../common/request-context/request-context.module';

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: buildPinoHttpOptions(process.env.NODE_ENV === 'production') }),
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    RequestContextModule,
    DiscordModule,
    AuthModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
  ],
  exports: [AuthModule, RequestContextModule, ThrottlerModule],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(GlobalTraceIdMiddleware).forRoutes('*');
  }
}
