import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3001;
  app.enableCors({
    origin: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  // Traduz violacao de unique em 409 em vez de deixar virar 500.
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(port);
  console.log(`🚀 HirePair API is running on http://localhost:${port}`);
}
void bootstrap();
