import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PipelineContext } from '../pipeline.context';

@Injectable()
export class ParseStage {
  private readonly logger = new Logger(ParseStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(ctx: PipelineContext): Promise<void> {
    // Upload-time parsing populated parsedText + previewHtml. Verify they exist;
    // if not, something is wrong upstream.
    const doc = await this.prisma.document.findUniqueOrThrow({
      where: { id: ctx.primaryDocumentId },
      select: { parsedText: true, previewHtml: true, filename: true },
    });

    if (!doc.parsedText || doc.parsedText.length < 50) {
      throw new Error(
        `Parsed text missing or too short (${doc.parsedText?.length ?? 0} chars). Re-parse the document.`,
      );
    }
    if (!doc.previewHtml) {
      throw new Error('Preview HTML missing — re-parse the document.');
    }

    this.logger.log(
      `PARSE verified: doc=${ctx.primaryDocumentId} (${doc.filename}, ${doc.parsedText.length} chars)`,
    );
  }
}