import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { CriticalSeverity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { PipelineContext } from '../pipeline.context';

// ─────────────────────────────────────────────────────────────
// Output schema. The model's JSON must match this exactly; failures throw.
// ─────────────────────────────────────────────────────────────
const CriticalPointSchema = z.object({
  text: z.string().min(5).max(500),
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  source_quote: z.string().min(5).max(500),
});
const CriticalPointsOutputSchema = z.object({
  points: z.array(CriticalPointSchema).max(15),
});
type CriticalPointsOutput = z.infer<typeof CriticalPointsOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are extracting patient-facing critical points from a medical document.

A "critical point" is something the patient must not miss. Examples:
- A medication that must be taken at a specific time (e.g. "take at bedtime").
- A duration limit on a medication (e.g. "8-week course only").
- A side effect they must report immediately (e.g. "report unexplained muscle pain").
- A follow-up appointment with a specific timing.
- An activity restriction (e.g. "do not drive until you know how this affects you").
- A specific warning the document calls out to the patient.

Severity guidance:
- HIGH: missing this could cause direct harm (wrong-time dosing of a key drug; unreported serious side effect; duration limit on a benzodiazepine).
- MEDIUM: missing this could degrade outcomes but is not immediately dangerous (a follow-up appointment; a non-urgent dietary note).
- LOW: useful general guidance from the document (medication should be taken consistently; mild side effect to monitor).

Hard rules:
1. EVERY point must be drawn from the document's own words. The "source_quote" field must contain a short verbatim excerpt (≤ 200 chars) from the document that justifies the point.
2. Do NOT invent advice that is not in the document. If the document doesn't mention something, don't add it.
3. Do NOT include generic medical advice ("take medications as prescribed", "see a doctor if you feel unwell"). Only document-specific items.
4. Maximum 10 points. Prioritize HIGH severity. If the document has fewer than 10 worthy points, return fewer — quality over quantity.
5. Each point's "text" should be a single sentence in plain language, ≤ 25 words. Do not use second person ("you"); use neutral phrasing ("the patient should...").

Return ONLY a JSON object in this exact shape:
{
  "points": [
    { "text": "...", "severity": "HIGH" | "MEDIUM" | "LOW", "source_quote": "..." }
  ]
}

No other text, no markdown, no preamble.`;

@Injectable()
export class CriticalPointsStage {
  private readonly logger = new Logger(CriticalPointsStage.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async run(ctx: PipelineContext): Promise<void> {
    // Idempotency
    const existing = await this.prisma.criticalPoint.count({
      where: { jobId: ctx.jobId },
    });
    if (existing > 0) {
      this.logger.log(`CRITICAL_POINTS skipped: ${existing} already exist`);
      return;
    }

    const doc = await this.prisma.document.findUniqueOrThrow({
      where: { id: ctx.primaryDocumentId },
      select: { parsedText: true },
    });
    if (!doc.parsedText) throw new Error('Document parsedText is empty');

    const raw = await this.llm.completeJson<unknown>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Document:\n\n${doc.parsedText}`,
      maxTokens: 1500,
      temperature: 0,
    });

    const parsed = CriticalPointsOutputSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.error(
        `CRITICAL_POINTS schema validation failed: ${parsed.error.message}`,
      );
      throw new Error(
        `LLM returned malformed critical points JSON: ${parsed.error.message}`,
      );
    }

    const points = this.dedupeAndValidate(parsed.data, doc.parsedText);

    if (points.length === 0) {
      this.logger.warn(
        `CRITICAL_POINTS produced 0 valid points for job=${ctx.jobId}`,
      );
      return; // Not a failure — some documents legitimately have no critical points
    }

    await this.prisma.criticalPoint.createMany({
      data: points.map((p) => ({
        jobId: ctx.jobId,
        text: p.text,
        severity: p.severity as CriticalSeverity,
        sourcePage: null, // DOCX has no stable page numbers
      })),
    });

    this.logger.log(
      `CRITICAL_POINTS wrote ${points.length} points (raw=${parsed.data.points.length}) for job=${ctx.jobId}`,
    );
  }

  /**
   * Post-LLM validation:
   *  1. Dedupe near-identical points (model sometimes outputs paraphrases of the same item)
   *  2. Drop any point whose source_quote is NOT actually present in the doc
   *     — this is the grounding check that catches hallucinated quotes
   *  3. Normalize severity ordering for downstream display
   */
  private dedupeAndValidate(
    output: CriticalPointsOutput,
    docText: string,
  ): CriticalPointsOutput['points'] {
    const seen = new Set<string>();
    const valid: CriticalPointsOutput['points'] = [];
    const normalizedDoc = this.normalize(docText);

    for (const p of output.points) {
      // Grounding: the quote must appear in the document (loose match)
      const normQuote = this.normalize(p.source_quote);
      if (normQuote.length < 5 || !normalizedDoc.includes(normQuote)) {
        this.logger.debug(
          `Dropping ungrounded point: "${p.text.slice(0, 60)}..." (quote not found)`,
        );
        continue;
      }

      const key = this.normalize(p.text);
      if (seen.has(key)) continue;
      seen.add(key);
      valid.push(p);
    }

    // Sort: HIGH first, then MEDIUM, then LOW, preserving model's order within each tier
    const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    valid.sort((a, b) => order[a.severity] - order[b.severity]);
    return valid;
  }

  /** Lowercase + collapse whitespace + strip non-alphanumeric for loose substring match. */
  private normalize(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
}