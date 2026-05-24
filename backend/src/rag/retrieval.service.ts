import { Injectable, Logger } from '@nestjs/common';
import pgvector from 'pgvector';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

export interface RetrievedChunk {
  id: string;
  documentId: string;
  ordinal: number;
  monograph: string | null;
  section: string | null;
  page: number | null;
  text: string;
  distance: number; // 0 = identical, 2 = opposite (cosine distance)
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
  ) {}

  /**
   * Top-K cosine-nearest chunks within a single document. We always scope to
   * one reference document so we never accidentally pull from the user's
   * primary doc when verifying.
   */
  async retrieve(args: {
    documentId: string;
    query: string;
    topK?: number;
  }): Promise<RetrievedChunk[]> {
    const topK = args.topK ?? 4;
    const queryVec = await this.embeddings.embedOne(args.query);
    const vecSql = pgvector.toSql(queryVec);

    // We use the <=> operator which is cosine distance under our HNSW index.
    // Returning distance lets the caller decide a relevance threshold.
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        documentId: string;
        ordinal: number;
        monograph: string | null;
        section: string | null;
        page: number | null;
        text: string;
        distance: number;
      }>
    >`
      SELECT
        id,
        "documentId" AS "documentId",
        ordinal,
        monograph,
        section,
        page,
        text,
        (embedding <=> ${vecSql}::vector) AS distance
      FROM chunks
      WHERE "documentId" = ${args.documentId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vecSql}::vector
      LIMIT ${topK}
    `;

    this.logger.debug(
      `Retrieved ${rows.length} chunks for query "${args.query.slice(0, 60)}..." top distance=${rows[0]?.distance.toFixed(3)}`,
    );
    return rows;
  }
}