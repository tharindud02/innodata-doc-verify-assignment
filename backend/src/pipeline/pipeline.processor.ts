import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JobStatus, StageName } from '@prisma/client';
import { PIPELINE_QUEUE, PipelineJobData } from '../jobs/queue.constants';
import { PrismaService } from '../prisma/prisma.service';
import { StageTracker } from './stage-tracker.service';
import { PipelineContext } from './pipeline.context';
import { ParseStage } from './stages/parse.stage';
import { ChunkStage } from './stages/chunk.stage';
import { EmbedStage } from './stages/embed.stage';
import { SummarizeStage } from './stages/summarize.stage';
import { CriticalPointsStage } from './stages/critical-points.stage';
import { ExtractStage } from './stages/extract.stage';
import { VerifyStage } from './stages/verify.stage';
import { structuredLog } from '../common/structured-log';

@Processor(PIPELINE_QUEUE)
export class PipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(PipelineProcessor.name);

  constructor(
    private readonly tracker: StageTracker,
    private readonly prisma: PrismaService,
    private readonly parseStage: ParseStage,
    private readonly chunkStage: ChunkStage,
    private readonly embedStage: EmbedStage,
    private readonly summarizeStage: SummarizeStage,
    private readonly criticalPointsStage: CriticalPointsStage,
    private readonly extractStage: ExtractStage,
    private readonly verifyStage: VerifyStage,
  ) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { jobId } = job.data;
    this.logger.log(
      structuredLog('pipeline.job.picked_up', {
        jobId,
        queueJobId: String(job.id ?? ''),
      }),
    );

    const dbJob = await this.prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      select: {
        primaryDocumentId: true,
        referenceDocumentId: true,
        userId: true,
      },
    });
    const ctx: PipelineContext = { jobId, ...dbJob };

    try {
      await this.tracker.setJobStatus(jobId, JobStatus.RUNNING);

      await this.tracker.run(jobId, StageName.PARSE, () => this.parseStage.run(ctx));
      await this.tracker.run(jobId, StageName.CHUNK, () => this.chunkStage.run(ctx));
      await this.tracker.run(jobId, StageName.EMBED, () => this.embedStage.run(ctx));
      await this.tracker.run(jobId, StageName.SUMMARIZE, () => this.summarizeStage.run(ctx));
      await this.tracker.run(jobId, StageName.CRITICAL_POINTS, () => this.criticalPointsStage.run(ctx));
      await this.tracker.run(jobId, StageName.EXTRACT, () => this.extractStage.run(ctx));
      await this.tracker.run(jobId, StageName.VERIFY, () => this.verifyStage.run(ctx));

      await this.tracker.setJobStatus(jobId, JobStatus.COMPLETED);
      this.logger.log(
        structuredLog('pipeline.job.completed', {
          jobId,
          userId: ctx.userId,
          primaryDocumentId: ctx.primaryDocumentId,
          referenceDocumentId: ctx.referenceDocumentId,
        }),
      );
    } catch (e) {
      const message = (e as Error).message ?? 'Unknown error';
      await this.tracker.setJobStatus(jobId, JobStatus.FAILED, message);
      this.logger.error(
        structuredLog('pipeline.job.failed', {
          jobId,
          userId: ctx.userId,
          primaryDocumentId: ctx.primaryDocumentId,
          referenceDocumentId: ctx.referenceDocumentId,
          error: message,
        }),
      );
      throw e;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PipelineJobData>, err: Error) {
    this.logger.error(
      structuredLog('pipeline.queue.failed', {
        queueJobId: String(job.id ?? ''),
        jobId: job.data?.jobId ?? null,
        error: err.message,
      }),
    );
  }
}
