import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { REQUEST_ID_HEADER } from './http-observability';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const storageDir = join(process.cwd(), 'storage');
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  app.useStaticAssets(storageDir, { prefix: '/uploads' });

  const port = Number(process.env.PORT ?? 4000);

  await app.listen(port);
  Logger.log(
    JSON.stringify({
      event: 'backend.started',
      port,
      requestIdHeader: REQUEST_ID_HEADER,
      url: `http://localhost:${port}`,
    }),
    'Bootstrap',
  );
}

void bootstrap();
