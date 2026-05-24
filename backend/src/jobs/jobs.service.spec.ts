import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  JobStatus,
  StageName,
  StageStatus,
} from '@prisma/client';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';

describe('JobsService', () => {
  let service: JobsService;
  let prisma: {
    job: { findUnique: jest.Mock };
  };

  const ownerId = 'user-owner';
  const intruderId = 'user-intruder';
  const jobId = 'job-1';

  const baseJob = {
    id: jobId,
    userId: ownerId,
    status: JobStatus.COMPLETED,
    summary: null,
    createdAt: new Date('2026-05-24T08:55:50.406Z'),
    completedAt: new Date('2026-05-24T08:55:54.226Z'),
    primaryDocument: { id: 'doc-1', filename: 'reference_document.docx' },
    stages: [
      StageName.PARSE,
      StageName.CHUNK,
      StageName.EMBED,
      StageName.SUMMARIZE,
      StageName.CRITICAL_POINTS,
      StageName.EXTRACT,
      StageName.VERIFY,
    ].map((name, i) => ({
      name,
      status: StageStatus.DONE,
      startedAt: new Date(`2026-05-24T08:55:5${i}.000Z`),
      endedAt: new Date(`2026-05-24T08:55:5${i}.500Z`),
      error: null,
    })),
    criticalPoints: [],
    entities: [],
  };

  beforeEach(() => {
    prisma = {
      job: { findUnique: jest.fn() },
    };
    service = new JobsService(prisma as unknown as PrismaService);
  });

  it('returns a completed snapshot with all 7 stages DONE and timestamps', async () => {
    prisma.job.findUnique.mockResolvedValue(baseJob);

    const detail = await service.getJobDetail({ userId: ownerId, jobId });

    expect(detail.status).toBe(JobStatus.COMPLETED);
    expect(detail.stages).toHaveLength(7);
    expect(detail.stages.every((s) => s.status === StageStatus.DONE)).toBe(
      true,
    );
    expect(detail.stages.every((s) => s.startedAt && s.endedAt)).toBe(true);
    expect(detail.completedAt).toBe('2026-05-24T08:55:54.226Z');
  });

  it('returns a mid-pipeline snapshot for refresh without losing stage progress', async () => {
    prisma.job.findUnique.mockResolvedValue({
      ...baseJob,
      status: JobStatus.RUNNING,
      completedAt: null,
      stages: baseJob.stages.map((stage, i) => {
        if (i === 0) {
          return {
            ...stage,
            status: StageStatus.DONE,
            startedAt: new Date('2026-05-24T08:58:22.827Z'),
            endedAt: new Date('2026-05-24T08:58:25.840Z'),
          };
        }
        if (i === 1) {
          return {
            ...stage,
            status: StageStatus.RUNNING,
            startedAt: new Date('2026-05-24T08:58:25.858Z'),
            endedAt: null,
          };
        }
        return {
          ...stage,
          status: StageStatus.PENDING,
          startedAt: null,
          endedAt: null,
        };
      }),
    });

    const detail = await service.getJobDetail({ userId: ownerId, jobId });

    expect(detail.status).toBe(JobStatus.RUNNING);
    expect(detail.stages[0]).toMatchObject({
      name: StageName.PARSE,
      status: StageStatus.DONE,
    });
    expect(detail.stages[1]).toMatchObject({
      name: StageName.CHUNK,
      status: StageStatus.RUNNING,
    });
    expect(detail.stages[2]).toMatchObject({
      name: StageName.EMBED,
      status: StageStatus.PENDING,
    });
  });

  it('throws NotFoundException when the job does not exist', async () => {
    prisma.job.findUnique.mockResolvedValue(null);

    await expect(
      service.getJobDetail({ userId: ownerId, jobId }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException when a different user requests the job', async () => {
    prisma.job.findUnique.mockResolvedValue(baseJob);

    await expect(
      service.getJobDetail({ userId: intruderId, jobId }),
    ).rejects.toMatchObject({
      response: { message: 'Not your job', statusCode: 403 },
    });
    await expect(
      service.getJobDetail({ userId: intruderId, jobId }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
