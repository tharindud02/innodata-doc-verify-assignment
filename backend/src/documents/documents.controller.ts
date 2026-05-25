import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import * as currentUserDecorator from '../auth/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import { UploadResultDto } from './dto/upload-result.dto';
import { ReferenceListItemDto } from './dto/reference-list-item.dto';
import { PipelineQueueService } from '../jobs/pipeline-queue.service';

@ApiTags('documents')
@ApiBearerAuth('jwt')
@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly documents: DocumentsService,
    private readonly queue: PipelineQueueService,
  ) {}

  @Get('references')
  @ApiOperation({ summary: 'List available institutional reference documents' })
  @ApiOkResponse({ type: ReferenceListItemDto, isArray: true })
  async listReferences(): Promise<ReferenceListItemDto[]> {
    const refs = await this.documents.listReferences();
    return refs.map((r) => ({
      id: r.id,
      filename: r.filename,
      createdAt: r.createdAt.toISOString(),
      chunkCount: r.chunkCount,
    }));
  }

  @Post('upload')
  @ApiOperation({
    summary: 'Upload primary document and enqueue async verification pipeline',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        referenceDocumentId: {
          type: 'string',
          nullable: true,
          description: 'Optional reference document ID; defaults to seeded formulary',
        },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: UploadResultDto })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  async upload(
    @currentUserDecorator.CurrentUser() user: currentUserDecorator.AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('referenceDocumentId') referenceDocumentId?: string,
  ): Promise<UploadResultDto> {
    // 1. Commit Document + Job + Stages atomically (Commit 5)
    const result = await this.documents.ingestUpload({
      userId: user.id,
      file,
      referenceDocumentId: referenceDocumentId?.trim() || undefined,
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
  @ApiOperation({ summary: 'Get sanitized HTML preview for a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { html: { type: 'string' } },
    },
  })
  async preview(
    @currentUserDecorator.CurrentUser() user: currentUserDecorator.AuthUser,
    @Param('id') id: string,
  ) {
    return this.documents.getPreviewHtml({ userId: user.id, documentId: id });
  }
}