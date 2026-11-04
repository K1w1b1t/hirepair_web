import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  configureApp(app);
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  return app;
}

export async function bootstrap(): Promise<void> {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 3001);
}

let server: Promise<NestExpressApplication> | undefined;

export default async function handler(req: Request, res: Response): Promise<void> {
  server ??= createApp().then(async (app) => {
    await app.init();
    return app;
  });
  const app = await server;
  app.getHttpAdapter().getInstance()(req, res);
}

if (require.main === module) {
  void bootstrap().catch((caught: unknown) => {
    console.error(caught);
    process.exitCode = 1;
  });
}
