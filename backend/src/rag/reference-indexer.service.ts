import { Injectable, Logger } from '@nestjs/common';
import pgvector from 'pgvector';
import { DocumentKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Chunker } from './chunker.service';
import { EmbeddingService } from './embedding.service';

@Injectable()
export class ReferenceIndexer {
  private readonly logger = new Logger(ReferenceIndexer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chunker: Chunker,
    private readonly embeddings: EmbeddingService,
  ) {}

  /**
   * Idempotent: if the reference document already has chunks, returns the count
   * without re-indexing. Caller (seed script) can pass force=true to rebuild.
   */
  async indexReference(args: {
    documentId: string;
    parsedText: string;
    force?: boolean;
  }): Promise<{ chunkCount: number; reindexed: boolean }> {
    const existing = await this.prisma.chunk.count({
      where: { documentId: args.documentId },
    });

    if (existing > 0 && !args.force) {
      this.logger.log(
        `Reference already indexed (${existing} chunks). Skipping.`,
      );
      return { chunkCount: existing, reindexed: false };
    }

    if (args.force) {
      await this.prisma.chunk.deleteMany({
        where: { documentId: args.documentId },
      });
      this.logger.log(`Cleared ${existing} stale chunks for re-indexing`);
    }

    const chunks = this.chunker.chunkReference(args.parsedText);
    if (chunks.length === 0) {
      throw new Error('Chunker returned 0 chunks — check reference format');
    }

    this.logger.log(`Embedding ${chunks.length} reference chunks...`);
    const vectors = await this.embeddings.embedMany(chunks.map((c) => c.text));

    // 1. Create chunk rows in a transaction (Prisma supports the model, just not the vector column).
    //    We insert with embedding=NULL, then update embeddings via raw SQL.
    const created = await this.prisma.$transaction(
      chunks.map((c) =>
        this.prisma.chunk.create({
          data: {
            documentId: args.documentId,
            ordinal: c.ordinal,
            monograph: c.monograph,
            section: c.section,
            page: null,
            text: c.text,
          },
          select: { id: true },
        }),
      ),
    );

    // 2. Populate the vector column via raw SQL (Unsupported types aren't writable via the typed client)
    for (let i = 0; i < created.length; i++) {
      const sqlVec = pgvector.toSql(vectors[i]);
      await this.prisma.$executeRaw`
        UPDATE chunks SET embedding = ${sqlVec}::vector WHERE id = ${created[i].id}
      `;
    }

    this.logger.log(
      `Reference indexed: ${created.length} chunks with embeddings`,
    );
    return { chunkCount: created.length, reindexed: true };
  }

  /** Convenience: index whichever REFERENCE document exists in the DB. */
  async indexAnyReference(force = false): Promise<void> {
    const ref = await this.prisma.document.findFirst({
      where: { kind: DocumentKind.REFERENCE },
    });
    if (!ref) {
      throw new Error('No REFERENCE document exists. Seed the document first.');
    }
    if (!ref.parsedText) {
      throw new Error(
        `Reference document ${ref.id} has no parsedText. Re-parse and try again.`,
      );
    }
    await this.indexReference({
      documentId: ref.id,
      parsedText: ref.parsedText,
      force,
    });
  }
}