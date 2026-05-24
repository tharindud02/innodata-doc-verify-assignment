import { Injectable, Logger } from '@nestjs/common';
import pgvector from 'pgvector';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from '../../rag/embedding.service';
import { PipelineContext } from '../pipeline.context';

@Injectable()
export class EmbedStage {
  private readonly logger = new Logger(EmbedStage.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
  ) {}

  async run(ctx: PipelineContext): Promise<void> {
    // Embed only chunks that don't yet have a vector — idempotent
    const chunks = await this.prisma.$queryRaw<
      Array<{ id: string; text: string }>
    >`
      SELECT id, text FROM chunks
      WHERE "documentId" = ${ctx.primaryDocumentId}
        AND embedding IS NULL
      ORDER BY ordinal ASC
    `;

    if (chunks.length === 0) {
      this.logger.log(`EMBED skipped: all chunks already embedded`);
      return;
    }

    const vectors = await this.embeddings.embedMany(chunks.map((c) => c.text));
    for (let i = 0; i < chunks.length; i++) {
      const sqlVec = pgvector.toSql(vectors[i]);
      await this.prisma.$executeRaw`
        UPDATE chunks SET embedding = ${sqlVec}::vector WHERE id = ${chunks[i].id}
      `;
    }

    this.logger.log(
      `EMBED wrote ${chunks.length} vectors for doc=${ctx.primaryDocumentId}`,
    );
  }
}