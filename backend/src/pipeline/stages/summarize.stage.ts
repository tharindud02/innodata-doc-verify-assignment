import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { PipelineContext } from '../pipeline.context';

const SYSTEM_PROMPT = `You are a careful clinical assistant. You will be given the text of a medical document such as a hospital discharge summary or clinic note.

Your job is to write a concise, faithful summary of the document for a non-clinical reader (a patient or family member). Follow these rules strictly:

1. Cover what the document is about: who the patient is in general terms, the reason for the encounter, the main diagnoses, the treatments given, the medications prescribed at discharge, and the follow-up plan. Do not list every fact; pick the most important.
2. Use plain language. Translate medical jargon into everyday words where reasonable. If a clinical term is essential (like "atrial fibrillation"), keep it and briefly explain it in parentheses.
3. Stay strictly within the document. Do not add clinical advice, recommendations, warnings, or interpretations that are not present in the source. Do not infer prognosis or causation that the document does not state.
4. Do not invent medication names, doses, or any specific numerical claim. If you are uncertain about a detail, omit it rather than guess.
5. Length target: 4 to 8 sentences. Do not use bullet points or markdown — return one or two short paragraphs of plain prose.
6. Do not address the patient in the second person ("you"). Use third-person neutral phrasing.
7. Return ONLY the summary text. No preamble, no headings, no "Summary:" prefix.`;

@Injectable()
export class SummarizeStage {
  private readonly logger = new Logger(SummarizeStage.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async run(ctx: PipelineContext): Promise<void> {
    const doc = await this.prisma.document.findUniqueOrThrow({
      where: { id: ctx.primaryDocumentId },
      select: { parsedText: true },
    });
    if (!doc.parsedText) throw new Error('Document parsedText is empty');

    // Idempotency: don't re-call the LLM if we already have a summary
    const existing = await this.prisma.job.findUniqueOrThrow({
      where: { id: ctx.jobId },
      select: { summary: true },
    });
    if (existing.summary && existing.summary.length > 0) {
      this.logger.log(`SUMMARIZE skipped: summary already present`);
      return;
    }

    const result = await this.llm.complete({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Document to summarize:\n\n${doc.parsedText}`,
      maxTokens: 600, // ~450 words, comfortably more than 8 sentences
      temperature: 0.3, // tiny temperature for natural prose without drift
    });

    if (!result.text || result.text.length < 50) {
      throw new Error(
        `Summary too short: ${result.text.length} chars (model may have refused)`,
      );
    }

    await this.prisma.job.update({
      where: { id: ctx.jobId },
      data: { summary: result.text },
    });

    this.logger.log(
      `SUMMARIZE wrote ${result.text.length} chars (${result.outputTokens} tokens) for job=${ctx.jobId}`,
    );
  }
}