import { Controller, Get, Logger, Param, Sse } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import * as currentUserDecorator from '../auth/decorators/current-user.decorator';
import { JobsService } from './jobs.service';
import { buildJobStream } from './jobs.sse';
import { JobDetailDto } from './dto/job-detail.dto';
import { JobListItemDto } from './dto/job-list-item.dto';

@ApiTags('jobs')
@ApiBearerAuth('jwt')
@Controller('jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(private readonly jobs: JobsService) {}

  /** GET /api/jobs — recent uploads for the current user */
  @Get()
  @ApiOperation({ summary: 'List recent jobs for current user' })
  @ApiOkResponse({ type: JobListItemDto, isArray: true })
  async listJobs(
    @currentUserDecorator.CurrentUser() user: currentUserDecorator.AuthUser,
  ): Promise<JobListItemDto[]> {
    return this.jobs.getUserJobs(user.id);
  }

  /** GET /api/jobs/:id — snapshot, for the initial page load or refresh */
  @Get(':id')
  @ApiOperation({ summary: 'Get single job detail snapshot' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiOkResponse({ type: JobDetailDto })
  async getJob(
    @currentUserDecorator.CurrentUser() user: currentUserDecorator.AuthUser,
    @Param('id') id: string,
  ): Promise<JobDetailDto> {
    return this.jobs.getJobDetail({ userId: user.id, jobId: id });
  }

  /** GET /api/jobs/:id/stream — SSE live updates until terminal status */
  @Sse(':id/stream')
  @ApiOperation({ summary: 'Stream live job updates using Server-Sent Events' })
  @ApiProduces('text/event-stream')
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiOkResponse({
    schema: {
      type: 'string',
      example: 'event: message\ndata: {"status":"RUNNING"}\n\n',
    },
  })
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