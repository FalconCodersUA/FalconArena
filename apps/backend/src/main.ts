import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { REQUEST_ID_HEADER } from './http-observability';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

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
