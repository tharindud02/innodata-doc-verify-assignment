import {
  Controller,
  Get,
  Logger,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as currentUserDecorator from '../auth/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import { UploadResultDto } from './dto/upload-result.dto';
import { PipelineQueueService } from '../jobs/pipeline-queue.service';

@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly documents: DocumentsService,
    private readonly queue: PipelineQueueService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  async upload(
    @currentUserDecorator.CurrentUser() user: currentUserDecorator.AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResultDto> {
    // 1. Commit Document + Job + Stages atomically (Commit 5)
    const result = await this.documents.ingestUpload({
      userId: user.id,
      file,
    });

    // 2. Enqueue the pipeline AFTER the DB commits.
    //    If this fails we log + return — the job sits in QUEUED status and
    //    can be retried by an admin/sweep. Documented as a known dual-write
    //    limitation in the README.
    try {
      await this.queue.enqueue(result.jobId);
    } catch (e) {
      this.logger.error(
        `Failed to enqueue pipeline for job ${result.jobId}: ${(e as Error).message}`,
      );
    }

    return result;
  }

  @Get(':id/preview')
  async preview(
    @currentUserDecorator.CurrentUser() user: currentUserDecorator.AuthUser,
    @Param('id') id: string,
  ) {
    return this.documents.getPreviewHtml({ userId: user.id, documentId: id });
  }
}