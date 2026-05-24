import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Chunker } from '../../rag/chunker.service';
import { PipelineContext } from '../pipeline.context';

@Injectable()
export class ChunkStage {
  private readonly logger = new Logger(ChunkStage.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chunker: Chunker,
  ) {}

  async run(ctx: PipelineContext): Promise<void> {
    const doc = await this.prisma.document.findUniqueOrThrow({
      where: { id: ctx.primaryDocumentId },
      select: { parsedText: true },
    });
    if (!doc.parsedText) throw new Error('Document parsedText is empty');

    // Idempotency: a retried job shouldn't double-insert chunks.
    const existingCount = await this.prisma.chunk.count({
      where: { documentId: ctx.primaryDocumentId },
    });
    if (existingCount > 0) {
      this.logger.log(
        `CHUNK skipped: ${existingCount} chunks already exist for doc=${ctx.primaryDocumentId}`,
      );
      return;
    }

    const chunks = this.chunker.chunkPrimary(doc.parsedText);
    if (chunks.length === 0) {
      throw new Error('Chunker returned 0 chunks — document may be empty');
    }

    await this.prisma.chunk.createMany({
      data: chunks.map((c) => ({
        documentId: ctx.primaryDocumentId,
        ordinal: c.ordinal,
        text: c.text,
        // monograph/section/page intentionally null — primary docs aren't drug-indexed
      })),
    });

    this.logger.log(
      `CHUNK created ${chunks.length} chunks for primary doc=${ctx.primaryDocumentId}`,
    );
  }
}