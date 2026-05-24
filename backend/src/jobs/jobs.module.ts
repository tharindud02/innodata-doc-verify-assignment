import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { PipelineQueueService } from './pipeline-queue.service';
import { PipelineProcessor } from '../pipeline/pipeline.processor';
import { PipelineModule } from '../pipeline/pipeline.module';
import { PIPELINE_QUEUE } from './queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: PIPELINE_QUEUE }),
    PipelineModule, // exports StageTracker + every stage the processor needs
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    PipelineQueueService,
    PipelineProcessor, 
  ],
  exports: [JobsService, PipelineQueueService],
})
export class JobsModule {}