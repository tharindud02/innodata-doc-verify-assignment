import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    ForbiddenException,
  } from '@nestjs/common';
  import { ConfigService } from '@nestjs/config';
  import * as path from 'node:path';
  import { DocumentKind, JobStatus, StageStatus } from '@prisma/client';
  import { PrismaService } from '../prisma/prisma.service';
  import { FileStorage } from '../common/file-storage';
  import { DocumentParser } from './document-parser.service';
  import { PIPELINE_STAGES } from '../pipeline/pipeline.constants';
  
  const ACCEPTED_MIME = new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
  ]);
  const ACCEPTED_EXT: Record<string, string> = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      '.docx',
    'application/pdf': '.pdf',
  };
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  
  @Injectable()
  export class DocumentsService {
    private readonly logger = new Logger(DocumentsService.name);
  
    constructor(
      private readonly prisma: PrismaService,
      private readonly storage: FileStorage,
      private readonly parser: DocumentParser,
      private readonly config: ConfigService,
    ) {}
  
    /**
     * Handle an upload end-to-end:
     *   1. Validate MIME/size.
     *   2. Hash + write file to disk.
     *   3. Parse to text + sanitized HTML.
     *   4. In a single transaction: insert Document, Job, and 7 PENDING Stages.
     *   5. On rollback: best-effort delete of the written file (no orphans).
     *
     * Returns { jobId, documentId }. Pipeline enqueue happens in the caller
     * (DocumentsController) so this method stays pure DB work.
     */
    async ingestUpload(args: {
      userId: string;
      file: Express.Multer.File;
    }): Promise<{ jobId: string; documentId: string }> {
      const { userId, file } = args;
      this.validate(file);
  
      const contentHash = this.storage.hash(file.buffer);
      const extension = ACCEPTED_EXT[file.mimetype];
      const relPath = await this.storage.write(file.buffer, contentHash, extension);
  
      let parsed;
      try {
        parsed = await this.parser.parse(file.buffer, file.mimetype);
      } catch (e) {
        // Couldn't parse — clean up the file we just wrote
        await this.storage.tryDelete(relPath);
        throw e;
      }
  
      // Look up the seeded reference document. We support exactly one for now;
      // adding more is a schema-only change later.
      const reference = await this.prisma.document.findFirst({
        where: { kind: DocumentKind.REFERENCE },
        select: { id: true },
      });
      if (!reference) {
        await this.storage.tryDelete(relPath);
        throw new InternalServerErrorException(
          'No reference document is configured. Run the seed script.',
        );
      }

      // Idempotent uploads: if the same user uploads the same bytes twice in a
      // short window (double-click, network retry), return the existing job
      // instead of creating duplicate documents/jobs. Window is configurable via
      // DEDUP_WINDOW_MS (default 5 minutes).
      const dedupWindowMs = Number(
        this.config.get<string>('DEDUP_WINDOW_MS') ?? 300_000,
      );
      const windowStart = new Date(Date.now() - dedupWindowMs);
      const existingJob = await this.prisma.job.findFirst({
        where: {
          userId,
          createdAt: { gte: windowStart },
          primaryDocument: { contentHash },
        },
        select: { id: true, primaryDocumentId: true },
        orderBy: { createdAt: 'desc' },
      });
      if (existingJob) {
        await this.storage.tryDelete(relPath);
        this.logger.log(
          `Deduped upload: user=${userId} job=${existingJob.id} hash=${contentHash.slice(0, 8)}`,
        );
        return {
          jobId: existingJob.id,
          documentId: existingJob.primaryDocumentId,
        };
      }

      try {
        const { jobId, documentId } = await this.prisma.$transaction(
          async (tx) => {
            const doc = await tx.document.create({
              data: {
                userId,
                kind: DocumentKind.PRIMARY,
                filename: file.originalname,
                mimeType: file.mimetype,
                storagePath: relPath,
                contentHash,
                parsedText: parsed.text,
                previewHtml: parsed.html,
                pageCount: parsed.pageCount,
              },
              select: { id: true },
            });
  
            const job = await tx.job.create({
              data: {
                userId,
                primaryDocumentId: doc.id,
                referenceDocumentId: reference.id,
                status: JobStatus.QUEUED,
              },
              select: { id: true },
            });
  
            // Pre-create all stages as PENDING so the frontend can render the
            // full pipeline immediately, with progress filling in as it runs.
            await tx.stage.createMany({
              data: PIPELINE_STAGES.map((name) => ({
                jobId: job.id,
                name,
                status: StageStatus.PENDING,
              })),
            });
  
            return { jobId: job.id, documentId: doc.id };
          },
        );
  
        this.logger.log(
          `Upload accepted: user=${userId} doc=${documentId} job=${jobId} hash=${contentHash.slice(0, 8)}`,
        );
        return { jobId, documentId };
      } catch (e) {
        // Transaction rolled back — clean up the file too
        await this.storage.tryDelete(relPath);
        this.logger.error(
          `Upload transaction failed for user=${userId}: ${(e as Error).message}`,
        );
        throw e;
      }
    }
  
    /**
     * Return sanitized HTML for the document preview pane on the frontend.
     * Authorization: only the document owner can view it (or it can be a
     * REFERENCE document, which is institutional and readable by any user).
     */
    async getPreviewHtml(args: {
      userId: string;
      documentId: string;
    }): Promise<{ html: string }> {
      const doc = await this.prisma.document.findUnique({
        where: { id: args.documentId },
        select: { id: true, userId: true, kind: true, previewHtml: true },
      });
      if (!doc) throw new NotFoundException('Document not found');
  
      const isReference = doc.kind === DocumentKind.REFERENCE;
      const isOwner = doc.userId === args.userId;
      if (!isReference && !isOwner) {
        throw new ForbiddenException('Not your document');
      }
  
      return { html: doc.previewHtml ?? '<p><em>No preview available.</em></p>' };
    }
  
    // ──────────────── private helpers ────────────────
  
    private validate(file: Express.Multer.File | undefined): void {
      if (!file) throw new BadRequestException('No file uploaded');
      if (!ACCEPTED_MIME.has(file.mimetype)) {
        throw new BadRequestException(
          `Unsupported file type: ${file.mimetype}. Accepted: DOCX, PDF.`,
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException(
          `File too large: ${file.size} bytes (max ${MAX_FILE_SIZE})`,
        );
      }
      // Defense in depth: check the extension matches the MIME
      const expected = ACCEPTED_EXT[file.mimetype];
      if (!file.originalname.toLowerCase().endsWith(expected)) {
        throw new BadRequestException(
          `Filename extension does not match MIME type (expected ${expected})`,
        );
      }
    }
  }