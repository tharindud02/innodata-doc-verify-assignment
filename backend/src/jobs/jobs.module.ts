import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { PipelineQueueService } from './pipeline-queue.service';
import { PipelineProcessor } from '../pipeline/pipeline.processor';
import { StageTracker } from '../pipeline/stage-tracker.service';
import { PIPELINE_QUEUE } from './queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: PIPELINE_QUEUE })],
  controllers: [JobsController],
  providers: [
    JobsService,
    PipelineQueueService,
    PipelineProcessor,
    StageTracker,
  ],
  exports: [JobsService, PipelineQueueService, StageTracker],
})
export class JobsModule {}