import {
    Controller,
    Get,
    Param,
    Post,
    UploadedFile,
    UseInterceptors,
  } from '@nestjs/common';
  import { FileInterceptor } from '@nestjs/platform-express';
  import * as currentUserDecorator from '../auth/decorators/current-user.decorator';
  import { DocumentsService } from './documents.service';
  import { UploadResultDto } from './dto/upload-result.dto';
  
  @Controller('documents')
  export class DocumentsController {
    constructor(private readonly documents: DocumentsService) {}
  
    /**
     * POST /api/documents/upload
     * Multipart field name: "file"
     *
     * Returns immediately with { jobId, documentId } — pipeline runs async.
     * NOTE: pipeline enqueue happens here (after the service commits the DB
     * transaction), via the queue dependency wired in Commit 6. For now, the
     * job sits in QUEUED status; the worker we add next will pick it up.
     */
    @Post('upload')
    @UseInterceptors(
      FileInterceptor('file', {
        limits: { fileSize: 5 * 1024 * 1024 },
      }),
    )
    async upload(
      @currentUserDecorator.CurrentUser() user: currentUserDecorator.AuthUser,
      @UploadedFile() file: Express.Multer.File,
    ): Promise<UploadResultDto> {
      return this.documents.ingestUpload({ userId: user.id, file });
    }
  
    /** GET /api/documents/:id/preview — sanitized HTML for the rendering pane */
    @Get(':id/preview')
    async preview(
      @currentUserDecorator.CurrentUser() user: currentUserDecorator.AuthUser,
      @Param('id') id: string,
    ) {
      return this.documents.getPreviewHtml({ userId: user.id, documentId: id });
    }
  }