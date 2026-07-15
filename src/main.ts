import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { getValidatedEnv } from '@config/env.validator';
import { setAppContext } from '@config/app-context';
import { AllExceptionsFilter } from '@shared/exceptions/all-exceptions.filter';

async function bootstrap() {
  const env = getValidatedEnv();

  setAppContext({
    logManager: {
      info: (msg: string, ...args: unknown[]) =>
        console.log(`[INFO] ${msg}`, ...args),
      warn: (msg: string, ...args: unknown[]) =>
        console.warn(`[WARN] ${msg}`, ...args),
      error: (msg: string, ...args: unknown[]) =>
        console.error(`[ERROR] ${msg}`, ...args),
      debug: (msg: string, ...args: unknown[]) =>
        console.debug(`[DEBUG] ${msg}`, ...args),
    },
    config: env as unknown as Record<string, unknown>,
  });

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Auth Service')
    .setDescription('Authentication service API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.enableCors();

  await app.listen(env.PORT);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
