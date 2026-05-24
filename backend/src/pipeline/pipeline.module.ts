import { Module } from '@nestjs/common';
import { ParseStage } from './stages/parse.stage';
import { ChunkStage } from './stages/chunk.stage';
import { EmbedStage } from './stages/embed.stage';
import { SummarizeStage } from './stages/summarize.stage';
import { CriticalPointsStage } from './stages/critical-points.stage';
import { ExtractStage } from './stages/extract.stage';
import { StageTracker } from './stage-tracker.service';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [RagModule],
  providers: [
    StageTracker,
    ParseStage,
    ChunkStage,
    EmbedStage,
    SummarizeStage,
    CriticalPointsStage,
    ExtractStage,
  ],
  exports: [
    StageTracker,
    ParseStage,
    ChunkStage,
    EmbedStage,
    SummarizeStage,
    CriticalPointsStage,
    ExtractStage,
  ],
})
export class PipelineModule {}