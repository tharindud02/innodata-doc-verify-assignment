import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JobStatus, StageName } from '@prisma/client';
import { PIPELINE_QUEUE, PipelineJobData } from '../jobs/queue.constants';
import { StageTracker } from './stage-tracker.service';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Processor(PIPELINE_QUEUE)
export class PipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(PipelineProcessor.name);

  constructor(private readonly tracker: StageTracker) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { jobId } = job.data;
    this.logger.log(`Picked up job ${jobId} (bullmq id=${job.id})`);

    try {
      await this.tracker.setJobStatus(jobId, JobStatus.RUNNING);

      // ── Stub stages (real implementations land in commits 8–10) ──
      await this.tracker.run(jobId, StageName.PARSE, async () => {
        await sleep(500);
      });
      await this.tracker.run(jobId, StageName.CHUNK, async () => {
        await sleep(500);
      });
      await this.tracker.run(jobId, StageName.EMBED, async () => {
        await sleep(500);
      });
      await this.tracker.run(jobId, StageName.SUMMARIZE, async () => {
        await sleep(500);
      });
      await this.tracker.run(jobId, StageName.CRITICAL_POINTS, async () => {
        await sleep(500);
      });
      await this.tracker.run(jobId, StageName.EXTRACT, async () => {
        await sleep(500);
      });
      await this.tracker.run(jobId, StageName.VERIFY, async () => {
        await sleep(500);
      });

      await this.tracker.setJobStatus(jobId, JobStatus.COMPLETED);
    } catch (e) {
      const message = (e as Error).message ?? 'Unknown error';
      await this.tracker.setJobStatus(jobId, JobStatus.FAILED, message);
      // Re-throw so BullMQ marks the bullmq-job as failed too (visible in any monitoring UI)
      throw e;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PipelineJobData>, err: Error) {
    this.logger.error(
      `BullMQ job ${job.id} (app jobId=${job.data?.jobId}) failed: ${err.message}`,
    );
  }
}