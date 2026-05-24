import { Module } from '@nestjs/common';
import { ParseStage } from './stages/parse.stage';
import { ChunkStage } from './stages/chunk.stage';
import { EmbedStage } from './stages/embed.stage';
import { SummarizeStage } from './stages/summarize.stage';
import { StageTracker } from './stage-tracker.service';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [RagModule], // for Chunker, EmbeddingService
  providers: [
    StageTracker,
    ParseStage,
    ChunkStage,
    EmbedStage,
    SummarizeStage,
  ],
  exports: [
    StageTracker,
    ParseStage,
    ChunkStage,
    EmbedStage,
    SummarizeStage,
  ],
})
export class PipelineModule {}