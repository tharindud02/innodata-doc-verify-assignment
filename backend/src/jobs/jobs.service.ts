import {
    ForbiddenException,
    Injectable,
    NotFoundException,
  } from '@nestjs/common';
  import { PrismaService } from '../prisma/prisma.service';
  import { JobDetailDto } from './dto/job-detail.dto';
  
  @Injectable()
  export class JobsService {
    constructor(private readonly prisma: PrismaService) {}
  
    /**
     * Build the full JobDetailDto used by both GET /jobs/:id and the SSE stream.
     * One query, one mapping. Anywhere else needs job state, it goes through here.
     */
    async getJobDetail(args: {
      userId: string;
      jobId: string;
    }): Promise<JobDetailDto> {
      const job = await this.prisma.job.findUnique({
        where: { id: args.jobId },
        include: {
          primaryDocument: { select: { id: true, filename: true } },
          stages: { orderBy: { name: 'asc' } },
          criticalPoints: { orderBy: { createdAt: 'asc' } },
          entities: {
            include: { flag: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
  
      if (!job) throw new NotFoundException('Job not found');
      if (job.userId !== args.userId) {
        throw new ForbiddenException('Not your job');
      }
  
      return {
        id: job.id,
        documentId: job.primaryDocument.id,
        filename: job.primaryDocument.filename,
        status: job.status,
        summary: job.summary,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
        stages: job.stages.map((s) => ({
          name: s.name,
          status: s.status,
          startedAt: s.startedAt?.toISOString() ?? null,
          endedAt: s.endedAt?.toISOString() ?? null,
          error: s.error,
        })),
        criticalPoints: job.criticalPoints.map((p) => ({
          id: p.id,
          text: p.text,
          severity: p.severity,
          sourcePage: p.sourcePage,
        })),
        flagged: job.entities.map((e) => ({
          entity: {
            id: e.id,
            drugName: e.drugName,
            dose: e.dose,
            unit: e.unit,
            route: e.route,
            frequency: e.frequency,
            duration: e.duration,
            indication: e.indication,
            sourcePage: e.sourcePage,
          },
          flag: e.flag
            ? {
                id: e.flag.id,
                entityId: e.flag.entityId,
                status: e.flag.status,
                explanation: e.flag.explanation,
                citationText: e.flag.citationText,
                citationPage: e.flag.citationPage,
                citationSection: e.flag.citationSection,
                citationChunkId: e.flag.citationChunkId,
              }
            : null,
        })),
      };
    }
  }