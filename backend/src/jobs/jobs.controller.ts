import { Controller, Get, Logger, Param, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import * as currentUserDecorator from '../auth/decorators/current-user.decorator';
import { JobsService } from './jobs.service';
import { buildJobStream } from './jobs.sse';
import { JobDetailDto } from './dto/job-detail.dto';

@Controller('jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(private readonly jobs: JobsService) {}

  /** GET /api/jobs/:id — snapshot, for the initial page load or refresh */
  @Get(':id')
  async getJob(
    @currentUserDecorator.CurrentUser() user: currentUserDecorator.AuthUser,
    @Param('id') id: string,
  ): Promise<JobDetailDto> {
    return this.jobs.getJobDetail({ userId: user.id, jobId: id });
  }

  /** GET /api/jobs/:id/stream — SSE live updates until terminal status */
  @Sse(':id/stream')
  stream(
    @currentUserDecorator.CurrentUser() user: currentUserDecorator.AuthUser,
    @Param('id') id: string,
  ): Observable<{ data: string }> {
    return buildJobStream({
      jobs: this.jobs,
      userId: user.id,
      jobId: id,
      logger: this.logger,
    });
  }
}