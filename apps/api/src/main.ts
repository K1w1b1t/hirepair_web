import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3001;
  app.enableCors({
    origin: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  await app.listen(port);
  console.log(`🚀 HirePair API is running on http://localhost:${port}`);
}
void bootstrap();
