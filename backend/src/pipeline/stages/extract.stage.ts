import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { PipelineContext } from '../pipeline.context';

// ─────────────────────────────────────────────────────────────
// Output schema
// ─────────────────────────────────────────────────────────────
const ExtractedEntitySchema = z.object({
  drug_name: z.string().min(1).max(100),
  dose: z.string().nullable(),       // "10" — number as string to preserve "0.5"
  unit: z.string().nullable(),       // "mg", "mcg", "mL"
  route: z.string().nullable(),      // "PO", "IV", "topical"
  frequency: z.string().nullable(),  // "once daily", "twice daily", "every 8 hours"
  duration: z.string().nullable(),   // "8 weeks", "continue indefinitely"
  indication: z.string().nullable(), // why the drug is prescribed
  source_quote: z.string().min(3).max(300),
});
const ExtractOutputSchema = z.object({
  medications: z.array(ExtractedEntitySchema).max(30),
});
type ExtractOutput = z.infer<typeof ExtractOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are extracting prescribed medications from a medical document as structured JSON.

For each medication that is being PRESCRIBED to the patient (not just mentioned in history), produce one entry with these fields:

- drug_name: the name of the medication exactly as written in the document (preserve capitalization and any branded form, e.g. "Cordizem-XR").
- dose: the numeric dose only, as a string (e.g. "10", "0.5", "100"). Null if not specified.
- unit: the unit (e.g. "mg", "mcg", "mL"). Null if not specified.
- route: the administration route (e.g. "PO", "IV", "topical", "SC"). Null if not specified. Use "PO" for "oral" / "by mouth" / "orally".
- frequency: how often (e.g. "once daily", "twice daily", "every 8 hours", "every morning", "before breakfast"). Preserve the document's wording. Null if not specified.
- duration: how long (e.g. "8 weeks", "continue indefinitely", "until follow-up"). Preserve the document's wording. Null if not specified.
- indication: why the drug is prescribed (e.g. "hypertension", "GERD prophylaxis", "anxiety"). Null if not stated near the prescription.
- source_quote: a short verbatim excerpt (≤ 200 chars) from the document that contains this prescription. Used for grounding — must appear in the document text exactly.

Hard rules:
1. Only include medications being PRESCRIBED at this encounter — not medications the patient is already on, not medications mentioned in history, not medications administered once during admission and stopped.
2. Do NOT invent fields. If the document does not state a value, return null. Never guess a dose or a duration.
3. Do NOT split one prescription into multiple entries even if it has complex frequency (e.g. "10 mg once daily" is one entry, not two).
4. If two different medications share the same indication, that is fine — one entry per medication.
5. Preserve drug names exactly. If the document says "Cordizem-XR", do not normalize to "Cordizem".

Return ONLY a JSON object in this exact shape:
{
  "medications": [
    {
      "drug_name": "...", "dose": "...", "unit": "...", "route": "...",
      "frequency": "...", "duration": "...", "indication": "...",
      "source_quote": "..."
    }
  ]
}

No other text, no markdown, no preamble.`;

@Injectable()
export class ExtractStage {
  private readonly logger = new Logger(ExtractStage.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async run(ctx: PipelineContext): Promise<void> {
    // Idempotency
    const existing = await this.prisma.entity.count({ where: { jobId: ctx.jobId } });
    if (existing > 0) {
      this.logger.log(`EXTRACT skipped: ${existing} entities already exist`);
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
      maxTokens: 2000,
      temperature: 0,
    });

    const parsed = ExtractOutputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `LLM returned malformed extraction JSON: ${parsed.error.message}`,
      );
    }

    const valid = this.validate(parsed.data, doc.parsedText);

    if (valid.length === 0) {
      this.logger.warn(
        `EXTRACT produced 0 medications for job=${ctx.jobId} — verification will be a no-op`,
      );
      return;
    }

    await this.prisma.entity.createMany({
      data: valid.map((m) => ({
        jobId: ctx.jobId,
        drugName: m.drug_name.trim(),
        dose: m.dose,
        unit: m.unit,
        route: m.route,
        frequency: m.frequency,
        duration: m.duration,
        indication: m.indication,
        sourcePage: null,
      })),
    });

    this.logger.log(
      `EXTRACT wrote ${valid.length} medications (raw=${parsed.data.medications.length}) for job=${ctx.jobId}: ${valid.map((m) => m.drug_name).join(', ')}`,
    );
  }

  /**
   * Validation pass:
   *  1. source_quote must appear in the document (grounding check)
   *  2. drug_name must appear in the document (catches fabricated drugs)
   *  3. dedupe on lowercased drug_name (same drug shouldn't appear twice)
   */
  private validate(
    output: ExtractOutput,
    docText: string,
  ): ExtractOutput['medications'] {
    const normalizedDoc = this.normalize(docText);
    const seen = new Set<string>();
    const valid: ExtractOutput['medications'] = [];

    for (const m of output.medications) {
      const drug = m.drug_name.trim();
      if (!drug) continue;

      // Grounding: drug name must appear in the document
      if (!normalizedDoc.includes(this.normalize(drug))) {
        this.logger.debug(
          `Dropping fabricated drug: "${drug}" — name not found in document`,
        );
        continue;
      }

      // Grounding: the source quote must also appear in the document
      const normQuote = this.normalize(m.source_quote);
      if (normQuote.length < 3 || !normalizedDoc.includes(normQuote)) {
        this.logger.debug(
          `Dropping entity "${drug}" — source_quote not found in document`,
        );
        continue;
      }

      const key = drug.toLowerCase();
      if (seen.has(key)) {
        this.logger.debug(`Dropping duplicate drug entry: "${drug}"`);
        continue;
      }
      seen.add(key);
      valid.push(m);
    }

    return valid;
  }

  private normalize(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
}