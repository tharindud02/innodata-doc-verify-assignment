import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PIPELINE_QUEUE, PipelineJobData } from './queue.constants';

@Injectable()
export class PipelineQueueService {
  private readonly logger = new Logger(PipelineQueueService.name);

  constructor(
    @InjectQueue(PIPELINE_QUEUE) private readonly queue: Queue<PipelineJobData>,
  ) {}

  async enqueue(jobId: string): Promise<void> {
    await this.queue.add(
      'process-document',
      { jobId },
      {
        // No automatic retries — LLM work is non-deterministic; we'd rather
        // fail loud and let the user re-trigger explicitly.
        attempts: 1,
        removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    );
    this.logger.log(`Enqueued pipeline job for app jobId=${jobId}`);
  }
}