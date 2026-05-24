/**
 * Idempotent seed script. Run with:
 *   npm run prisma:seed
 *
 * What it does:
 *   1. Creates demo user (SEED_USER_EMAIL / SEED_USER_PASSWORD from env)
 *   2. Loads & parses assets/reference_document.docx
 *   3. Creates the REFERENCE Document row (idempotent by contentHash)
 *   4. Chunks by monograph + embeds + writes to pgvector
 *
 * The reviewer can clone the repo, run `docker compose up -d`, `npm run prisma:migrate`,
 * and `npm run prisma:seed`, and have a fully populated system in under a minute.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as bcrypt from 'bcrypt';
import { DocumentKind } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { FileStorage } from '../src/common/file-storage';
import { DocumentParser } from '../src/documents/document-parser.service';
import { ReferenceIndexer } from '../src/rag/reference-indexer.service';

async function main() {
  const logger = new Logger('Seed');

  // Bootstrap a Nest app context (no HTTP server) so we can use providers
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const config = app.get(ConfigService);
    const storage = app.get(FileStorage);
    const parser = app.get(DocumentParser);
    const indexer = app.get(ReferenceIndexer);

    // ── 1. Demo user ────────────────────────────────────────────────────────
    const email = config.get<string>('SEED_USER_EMAIL', 'demo@meridianbay.test');
    const password = config.get<string>('SEED_USER_PASSWORD', 'demo1234');
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      logger.log(`Demo user already exists: ${email}`);
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({ data: { email, passwordHash } });
      logger.log(`Created demo user: ${email}`);
    }

    // ── 2. Reference document ───────────────────────────────────────────────
    const refPath = path.resolve(__dirname, '../assets/reference_document.docx');
    const buffer = await fs.readFile(refPath);
    const hash = storage.hash(buffer);

    let reference = await prisma.document.findFirst({
      where: { kind: DocumentKind.REFERENCE, contentHash: hash },
    });

    if (reference) {
      logger.log(`Reference document already exists: ${reference.id}`);
    } else {
      const mimeType =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const storagePath = await storage.write(buffer, hash, '.docx');
      const parsed = await parser.parse(buffer, mimeType);

      reference = await prisma.document.create({
        data: {
          userId: null,
          kind: DocumentKind.REFERENCE,
          filename: 'reference_document.docx',
          mimeType,
          storagePath,
          contentHash: hash,
          parsedText: parsed.text,
          previewHtml: parsed.html,
          pageCount: parsed.pageCount,
        },
      });
      logger.log(`Created reference document: ${reference.id}`);
    }

    // ── 3. Chunk + embed (idempotent unless --force is passed) ──────────────
    const force = process.argv.includes('--force');
    const result = await indexer.indexReference({
      documentId: reference.id,
      parsedText: reference.parsedText!,
      force,
    });
    logger.log(
      `Reference indexing: ${result.chunkCount} chunks (${result.reindexed ? 're-indexed' : 'cached'})`,
    );

    logger.log('✅ Seed complete');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', e);
  process.exit(1);
});