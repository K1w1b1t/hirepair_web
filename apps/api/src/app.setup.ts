import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { apiDocsEnabled, parseCorsOrigins } from './config/http-config';
import { GLOBAL_TRACE_ID_HEADER } from './common/request-context/request-context.constants';

const BODY_LIMIT = '10mb';

export function configureApp(
  app: NestExpressApplication,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));
  app.enableShutdownHooks();
  app.use(helmet());
  app.enableCors({
    origin: parseCorsOrigins(environment.CORS_ORIGIN),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH', 'OPTIONS'],
    exposedHeaders: [GLOBAL_TRACE_ID_HEADER, 'Content-Disposition'],
    credentials: true,
    maxAge: 86400,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  if (apiDocsEnabled(environment.NODE_ENV, environment.API_DOCS_ENABLED)) {
    const config = new DocumentBuilder()
      .setTitle('HirePair API')
      .setDescription('API do HirePair')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }
}
