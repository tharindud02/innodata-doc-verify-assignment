import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { DocumentsModule } from './documents/documents.module';
import { JobsModule } from './jobs/jobs.module';
import { RagModule } from './rag/rag.module';
import { LlmModule } from './llm/llm.module';
import { PipelineModule } from './pipeline/pipeline.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env'],
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(16).required(),
        JWT_EXPIRES_IN: Joi.string().default('7d'),
        LLM_PROVIDER: Joi.string().valid('openai', 'anthropic').optional(),
        OPENAI_API_KEY: Joi.string().optional(),
        OPENAI_MODEL: Joi.string().default('gpt-4o'),
        ANTHROPIC_API_KEY: Joi.string().optional(),
        ANTHROPIC_AUTH_TOKEN: Joi.string().optional(),
        ANTHROPIC_BASE_URL: Joi.string().uri().optional(),
        ANTHROPIC_MODEL: Joi.string().default('claude-opus-4-6'),
        BACKEND_PORT: Joi.number().default(3001),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        SEED_USER_EMAIL: Joi.string().email().optional(),
        SEED_USER_PASSWORD: Joi.string().optional(),
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    CommonModule,
    PrismaModule,
    AuthModule,
    DocumentsModule,
    JobsModule,
    RagModule,
    LlmModule,
    PipelineModule
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}