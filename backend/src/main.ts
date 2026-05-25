import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get<string>('FRONTEND_ORIGIN', 'http://localhost:5173'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Document Verification API')
    .setDescription(
      'Backend API for upload, async pipeline processing, and verification results.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('BACKEND_PORT', 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 Backend listening on http://localhost:${port}/api`);
  // eslint-disable-next-line no-console
  console.log(`📘 API docs available at http://localhost:${port}/api/docs`);
}
void bootstrap();