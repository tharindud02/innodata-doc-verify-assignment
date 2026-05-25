import { Injectable, Logger } from '@nestjs/common';
import { StageName, StageStatus, JobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { structuredLog } from '../common/structured-log';

@Injectable()
export class StageTracker {
  private readonly logger = new Logger(StageTracker.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run `fn` while keeping the Stage row in sync.
   *   - PENDING → RUNNING at entry (sets startedAt)
   *   - DONE at success (sets endedAt)
   *   - FAILED at error (sets endedAt + error message) and rethrows
   *
   * The stage row must already exist (pre-created at upload time).
   */
  async run<T>(
    jobId: string,
    name: StageName,
    fn: () => Promise<T>,
  ): Promise<T> {
    await this.prisma.stage.update({
      where: { jobId_name: { jobId, name } },
      data: { status: StageStatus.RUNNING, startedAt: new Date(), error: null },
    });
    this.logger.log(
      structuredLog('pipeline.stage.started', {
        jobId,
        stage: name,
      }),
    );

    const startNs = process.hrtime.bigint();
    try {
      const result = await fn();
      const durMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
      await this.prisma.stage.update({
        where: { jobId_name: { jobId, name } },
        data: { status: StageStatus.DONE, endedAt: new Date() },
      });
      this.logger.log(
        structuredLog('pipeline.stage.completed', {
          jobId,
          stage: name,
          durationMs: Number(durMs.toFixed(0)),
        }),
      );
      return result;
    } catch (e) {
      const message = (e as Error).message ?? 'Unknown error';
      await this.prisma.stage.update({
        where: { jobId_name: { jobId, name } },
        data: {
          status: StageStatus.FAILED,
          endedAt: new Date(),
          error: message.slice(0, 1000),
        },
      });
      this.logger.error(
        structuredLog('pipeline.stage.failed', {
          jobId,
          stage: name,
          error: message,
        }),
      );
      throw e;
    }
  }

  /** Mark the job itself as RUNNING / COMPLETED / FAILED. */
  async setJobStatus(
    jobId: string,
    status: JobStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        startedAt: status === JobStatus.RUNNING ? new Date() : undefined,
        completedAt:
          status === JobStatus.COMPLETED || status === JobStatus.FAILED
            ? new Date()
            : undefined,
        errorMessage: errorMessage ?? null,
      },
    });
    this.logger.log(
      structuredLog('pipeline.job.status_updated', {
        jobId,
        status,
        error: errorMessage ?? null,
      }),
    );
  }
}