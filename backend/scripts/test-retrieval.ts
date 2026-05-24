/**
 * Smoke test: given a query, retrieve top-3 chunks and print their monographs.
 * Run with: npx dotenv-cli -e ../.env -- ts-node scripts/test-retrieval.ts
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentKind } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RetrievalService } from '../src/rag/retrieval.service';

async function main() {
  const logger = new Logger('TestRetrieval');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const retrieval = app.get(RetrievalService);

    const ref = await prisma.document.findFirstOrThrow({
      where: { kind: DocumentKind.REFERENCE },
      select: { id: true },
    });

    const queries = [
      'Etrazolam 0.5 mg twice daily for 8 weeks for anxiety',
      'Pravoxil 20 mg every morning for hyperlipidemia',
      'Pranixol 10 mg once daily for cardiovascular protection',
      'Velantine 10 mg once daily for hypertension',
    ];

    for (const q of queries) {
      const results = await retrieval.retrieve({
        documentId: ref.id,
        query: q,
        topK: 3,
      });
      logger.log(`\nQUERY: ${q}`);
      results.forEach((r, i) => {
        logger.log(
          `  ${i + 1}. ${r.monograph ?? '(no monograph)'} — distance=${r.distance.toFixed(3)}`,
        );
      });
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});