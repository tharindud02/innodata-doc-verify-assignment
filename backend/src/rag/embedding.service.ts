import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

// @xenova/transformers is ESM-only; we use dynamic import inside the class
// so the rest of the codebase (CommonJS via Nest CLI) doesn't need ESM.
type FeatureExtractionPipeline = (
  texts: string | string[],
  options?: { pooling?: 'mean' | 'cls' | 'none'; normalize?: boolean },
) => Promise<{ data: Float32Array; dims: number[] }>;

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private pipeline: FeatureExtractionPipeline | null = null;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';

  /** 384 — matches the schema's vector(384) column. */
  static readonly DIMENSIONS = 384;

  async onModuleInit() {
    this.logger.log(`Loading embedding model: ${this.modelName}`);
    const start = Date.now();
    // Dynamic import works around CommonJS/ESM interop in NestJS
    const { pipeline } = await import('@xenova/transformers');
    this.pipeline = (await pipeline(
      'feature-extraction',
      this.modelName,
    )) as unknown as FeatureExtractionPipeline;
    this.logger.log(
      `Embedding model ready (${Date.now() - start}ms, dim=${EmbeddingService.DIMENSIONS})`,
    );
  }

  /**
   * Embed a single text. Mean-pooled and L2-normalized — required for cosine
   * similarity to behave correctly with our HNSW index.
   */
  async embedOne(text: string): Promise<number[]> {
    return (await this.embedMany([text]))[0];
  }

  /**
   * Embed a batch. all-MiniLM truncates at 512 tokens (~2000 chars) — fine for
   * our monograph-sized chunks. Caller should warn if chunks exceed this.
   */
  async embedMany(texts: string[]): Promise<number[][]> {
    if (!this.pipeline) {
      throw new Error('Embedding pipeline not initialized yet');
    }
    if (texts.length === 0) return [];

    const result = await this.pipeline(texts, {
      pooling: 'mean',
      normalize: true,
    });

    // Result is a Float32Array shaped [n_texts, 384]. Slice it back into rows.
    const dim = result.dims[result.dims.length - 1];
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      const start = i * dim;
      const end = start + dim;
      vectors.push(Array.from(result.data.slice(start, end)));
    }
    return vectors;
  }
}