import { Logger } from '@nestjs/common';
import { firstValueFrom, toArray } from 'rxjs';
import { JobStatus, StageName, StageStatus } from '@prisma/client';
import { buildJobStream } from './jobs.sse';
import { JobsService } from './jobs.service';
import { JobDetailDto } from './dto/job-detail.dto';

describe('buildJobStream', () => {
  const logger = new Logger('test');
  const userId = 'user-owner';
  const jobId = 'job-1';

  const runningDetail = (): JobDetailDto => ({
    id: jobId,
    documentId: 'doc-1',
    referenceDocumentId: 'ref-doc-1',
    filename: 'reference_document.docx',
    status: JobStatus.RUNNING,
    summary: null,
    createdAt: '2026-05-24T08:57:32.116Z',
    completedAt: null,
    criticalPoints: [],
    flagged: [],
    stages: [
      {
        name: StageName.PARSE,
        status: StageStatus.RUNNING,
        startedAt: '2026-05-24T08:57:32.134Z',
        endedAt: null,
        error: null,
      },
      {
        name: StageName.CHUNK,
        status: StageStatus.PENDING,
        startedAt: null,
        endedAt: null,
        error: null,
      },
      {
        name: StageName.EMBED,
        status: StageStatus.PENDING,
        startedAt: null,
        endedAt: null,
        error: null,
      },
      {
        name: StageName.SUMMARIZE,
        status: StageStatus.PENDING,
        startedAt: null,
        endedAt: null,
        error: null,
      },
      {
        name: StageName.CRITICAL_POINTS,
        status: StageStatus.PENDING,
        startedAt: null,
        endedAt: null,
        error: null,
      },
      {
        name: StageName.EXTRACT,
        status: StageStatus.PENDING,
        startedAt: null,
        endedAt: null,
        error: null,
      },
      {
        name: StageName.VERIFY,
        status: StageStatus.PENDING,
        startedAt: null,
        endedAt: null,
        error: null,
      },
    ],
  });

  const completedDetail = (): JobDetailDto => ({
  ...runningDetail(),
    status: JobStatus.COMPLETED,
    completedAt: '2026-05-24T08:57:35.769Z',
    stages: runningDetail().stages.map((stage) => ({
      ...stage,
      status: StageStatus.DONE,
      startedAt: stage.startedAt ?? '2026-05-24T08:57:32.134Z',
      endedAt: '2026-05-24T08:57:35.753Z',
    })),
  });

  it('emits only when the snapshot changes and closes on COMPLETED', async () => {
    const getJobDetail = jest
      .fn<Promise<JobDetailDto>, [{ userId: string; jobId: string }]>()
      .mockResolvedValueOnce(runningDetail())
      .mockResolvedValueOnce(runningDetail())
      .mockResolvedValueOnce(completedDetail());

    const jobs = { getJobDetail } as unknown as JobsService;

    const messages = await firstValueFrom(
      buildJobStream({
        jobs,
        userId,
        jobId,
        logger,
        intervalMs: 10,
      }).pipe(toArray()),
    );

    expect(getJobDetail).toHaveBeenCalledTimes(3);
    expect(messages).toHaveLength(2);
    expect(JSON.parse(messages[0].data).status).toBe(JobStatus.RUNNING);
    expect(JSON.parse(messages[1].data).status).toBe(JobStatus.COMPLETED);
  });

  it('reconnects mid-pipeline with an immediate current snapshot', async () => {
    const midPipeline = (): JobDetailDto => ({
      ...runningDetail(),
      stages: runningDetail().stages.map((stage, i) => {
        if (i === 0) {
          return {
            ...stage,
            status: StageStatus.DONE,
            endedAt: '2026-05-24T08:58:25.840Z',
          };
        }
        if (i === 1) {
          return {
            ...stage,
            status: StageStatus.RUNNING,
            startedAt: '2026-05-24T08:58:25.858Z',
            endedAt: null,
          };
        }
        return stage;
      }),
    });

    const getJobDetail = jest
      .fn<Promise<JobDetailDto>, [{ userId: string; jobId: string }]>()
      .mockResolvedValueOnce(midPipeline())
      .mockResolvedValueOnce(completedDetail());

    const jobs = { getJobDetail } as unknown as JobsService;

    const messages = await firstValueFrom(
      buildJobStream({
        jobs,
        userId,
        jobId,
        logger,
        intervalMs: 10,
      }).pipe(toArray()),
    );

    const first = JSON.parse(messages[0].data) as JobDetailDto;
    expect(first.status).toBe(JobStatus.RUNNING);
    expect(first.stages[0].status).toBe(StageStatus.DONE);
    expect(first.stages[1].status).toBe(StageStatus.RUNNING);
    expect(JSON.parse(messages[1].data).status).toBe(JobStatus.COMPLETED);
  });

  it('propagates authorization failures from getJobDetail', async () => {
    const getJobDetail = jest
      .fn<Promise<JobDetailDto>, [{ userId: string; jobId: string }]>()
      .mockRejectedValue({
        response: { message: 'Not your job', statusCode: 403 },
      });

    const jobs = { getJobDetail } as unknown as JobsService;

    await expect(
      firstValueFrom(
        buildJobStream({
          jobs,
          userId: 'intruder',
          jobId,
          logger,
          intervalMs: 10,
        }),
      ),
    ).rejects.toMatchObject({
      response: { message: 'Not your job', statusCode: 403 },
    });
  });
});
