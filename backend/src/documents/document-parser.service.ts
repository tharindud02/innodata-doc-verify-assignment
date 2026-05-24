import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
import sanitizeHtml from 'sanitize-html';

export interface ParsedDocument {
  text: string;
  html: string;
  pageCount: number | null;
}

@Injectable()
export class DocumentParser {
  private readonly logger = new Logger(DocumentParser.name);

  async parse(buffer: Buffer, mimeType: string): Promise<ParsedDocument> {
    if (
      mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return this.parseDocx(buffer);
    }
    if (mimeType === 'application/pdf') {
      // Scope cut: PDF parsing left as a stretch goal.
      throw new BadRequestException(
        'PDF parsing not yet implemented — please upload a DOCX',
      );
    }
    throw new BadRequestException(`Unsupported MIME type: ${mimeType}`);
  }

  private async parseDocx(buffer: Buffer): Promise<ParsedDocument> {
    const [textResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ buffer }),
      mammoth.convertToHtml({ buffer }),
    ]);

    if (textResult.messages.length) {
      this.logger.debug(
        `mammoth text warnings: ${textResult.messages.length} message(s)`,
      );
    }

    const safeHtml = sanitizeHtml(htmlResult.value, {
      allowedTags: [
        'p', 'br', 'strong', 'em', 'u', 'b', 'i',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'blockquote', 'span', 'div',
      ],
      allowedAttributes: {
        '*': ['class'],
      },
      // Strip all event handlers, inline styles, scripts
      disallowedTagsMode: 'discard',
    });

    return {
      text: textResult.value,
      html: safeHtml,
      pageCount: null, // DOCX doesn't have a stable page concept without rendering
    };
  }
}