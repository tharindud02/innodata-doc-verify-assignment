import { Injectable, Logger } from '@nestjs/common';

export interface ReferenceChunkInput {
  ordinal: number;
  monograph: string | null;
  section: string | null;
  text: string;
}

export interface PrimaryChunkInput {
  ordinal: number;
  text: string;
}

/**
 * Chunking strategy is intentionally *different* for the two document kinds:
 *
 * - REFERENCE: chunked by monograph. Each drug = one chunk. Why: the reference
 *   is structured as discrete drug monographs; splitting a monograph would
 *   separate the dose from its constraints (e.g. Etrazolam's 4-week max).
 *
 * - PRIMARY: chunked by paragraph (small, ~500-char target). The primary
 *   doc isn't structured as drug entries — it's prose + a table. Paragraphs
 *   give the LLM bite-sized context for summarization without losing too much
 *   document-level coherence.
 */
@Injectable()
export class Chunker {
  private readonly logger = new Logger(Chunker.name);

  /**
   * Chunk the institutional formulary. Each Roman-numeral section ("I. Cardiovascular Agents",
   * "II. Lipid-Lowering Agents", ...) contains multiple monographs. The monograph header
   * is the drug name on a line by itself, followed by labeled lines (Drug class:, Indication:, ...).
   *
   * Heuristic, but it works for our specific reference doc.
   */
  chunkReference(parsedText: string): ReferenceChunkInput[] {
    const lines = parsedText.split('\n').map((l) => l.trimEnd());

    let currentSection: string | null = null;
    let currentMonograph: string | null = null;
    let currentBuffer: string[] = [];
    const chunks: ReferenceChunkInput[] = [];

    const flush = () => {
      if (!currentMonograph) return;
      const text = currentBuffer.join('\n').trim();
      if (!text) return;
      chunks.push({
        ordinal: chunks.length,
        monograph: currentMonograph,
        section: currentSection,
        text: `${currentMonograph}\n\n${text}`,
      });
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        currentBuffer.push('');
        continue;
      }

      // Section header: "I. Cardiovascular Agents" / "II. Lipid-Lowering Agents" / ...
      // Match Roman numerals 1-3 chars + period + space + Title Case text.
      if (/^[IVX]{1,3}\.\s+[A-Z]/.test(line)) {
        flush();
        currentSection = line;
        currentMonograph = null;
        currentBuffer = [];
        continue;
      }

      // Monograph header: single capitalized word/identifier on its own line,
      // not containing a colon or "mg" — signals a drug name.
      // The next line typically starts with "Drug class:".
      if (
        currentSection &&
        this.looksLikeDrugHeader(line) &&
        !line.includes(':') &&
        !/\d/.test(line)
      ) {
        flush();
        currentMonograph = line;
        currentBuffer = [];
        continue;
      }

      // Stop accumulating once we hit the quick-reference summary or doc control
      if (
        /^VII\.\s+Quick-Reference/i.test(line) ||
        /^VIII\.\s+Document Control/i.test(line)
      ) {
        flush();
        currentMonograph = null;
        currentSection = null;
        break;
      }

      currentBuffer.push(line);
    }
    flush();

    this.logger.log(
      `Reference chunked into ${chunks.length} monographs: ${chunks.map((c) => c.monograph).join(', ')}`,
    );
    return chunks;
  }

  /**
   * Paragraph-based chunking for primary documents. Tries to keep chunks under
   * ~500 characters; combines short consecutive paragraphs into single chunks.
   * Paragraph boundary = blank line.
   */
  chunkPrimary(parsedText: string, targetChars = 500): PrimaryChunkInput[] {
    const paragraphs = parsedText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const chunks: PrimaryChunkInput[] = [];
    let buffer = '';

    const flush = () => {
      if (buffer.trim()) {
        chunks.push({ ordinal: chunks.length, text: buffer.trim() });
        buffer = '';
      }
    };

    for (const para of paragraphs) {
      if (!buffer) {
        buffer = para;
      } else if (buffer.length + para.length + 2 <= targetChars * 1.5) {
        buffer += `\n\n${para}`;
      } else {
        flush();
        buffer = para;
      }
      if (buffer.length >= targetChars) flush();
    }
    flush();

    this.logger.log(`Primary chunked into ${chunks.length} chunks`);
    return chunks;
  }

  private looksLikeDrugHeader(line: string): boolean {
    // Capitalized first letter, 4-30 chars, no spaces in the main token
    // (drug names like "Cordizem-XR" allowed via hyphen).
    return /^[A-Z][A-Za-z0-9-]{3,29}$/.test(line);
  }
}