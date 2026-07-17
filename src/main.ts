import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { getValidatedEnv } from '@config/env.validator';
import { setAppContext } from '@config/app-context';
import { LogManagerService } from '@shared/logging/log-manager';
import { AllExceptionsFilter } from '@shared/exceptions/all-exceptions.filter';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const env = getValidatedEnv();

  const app = await NestFactory.create(AppModule);

  const logManager = app.get(LogManagerService);
  setAppContext({
    logManager,
    config: env as unknown as Record<string, unknown>,
  });

  app.use(cookieParser());

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
