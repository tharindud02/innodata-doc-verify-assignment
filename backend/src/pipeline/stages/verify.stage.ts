import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { Entity, FlagStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../llm/llm.service';
import {
  RetrievalService,
  RetrievedChunk,
} from '../../rag/retrieval.service';
import { PipelineContext } from '../pipeline.context';
import { structuredLog } from '../../common/structured-log';

// ─────────────────────────────────────────────────────────────
// Tunable: cosine-distance ceiling for "the reference even has a relevant
// monograph for this drug". Above this, we don't bother calling the LLM —
// we mark UNSUPPORTED directly. Measured empirically against the test
// queries in scripts/test-retrieval.ts: real drugs land ~0.15-0.25,
// fictional 'Pranixol' lands ~0.50.
// ─────────────────────────────────────────────────────────────
const RELEVANCE_DISTANCE_THRESHOLD = 0.45;
const TOP_K_RETRIEVAL = 3;

// ─────────────────────────────────────────────────────────────
// Output schema — strict
// ─────────────────────────────────────────────────────────────
const VerifyOutputSchema = z.object({
  status: z.enum(['SUPPORTED', 'CONTRADICTED', 'UNSUPPORTED']),
  explanation: z.string().min(10).max(800),
  citation_quote: z.string().max(500).nullable(),
});
type VerifyOutput = z.infer<typeof VerifyOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an institutional formulary verifier. You will be given a prescribed medication from a clinical document and one or more reference passages from the institutional formulary. Your job is to verify whether the prescription is consistent with the formulary.

Output one of three statuses:

- SUPPORTED: the reference contains a monograph for this drug, and the prescribed dose, frequency, duration, route, and timing are consistent with what the reference states. Minor wording differences are fine.

- CONTRADICTED: the reference contains a monograph for this drug, but one or more prescribed parameters conflict with the reference. Examples:
  - Dose exceeds the standard dose or the maximum dose stated.
  - Frequency does not match (e.g. prescribed "every morning" when reference says "at bedtime").
  - Duration exceeds an explicit institutional maximum (e.g. prescribed "8 weeks" when reference says "must not exceed 4 weeks").
  - Route or timing of administration conflicts with the reference.
  - The drug is contraindicated for the stated indication or condition.

- UNSUPPORTED: the reference does NOT contain a monograph for this drug. The retrieved passages are about other drugs and do not apply.

Hard rules:
1. Your decision must be based ONLY on the reference passages provided. Do not use outside knowledge. If the passages don't address a specific parameter, treat that parameter as consistent.
2. If a CONTRADICTED verdict, the "citation_quote" field must contain the exact verbatim sentence(s) from the reference passages that justify the contradiction. Maximum 200 characters; pick the most specific passage.
3. If a SUPPORTED verdict, the "citation_quote" should contain the verbatim sentence stating the standard dose/frequency/duration that the prescription matches.
4. If an UNSUPPORTED verdict, set "citation_quote" to null. Do not fabricate a citation.
5. The "explanation" should be 1-3 sentences in plain language explaining WHY. Always name the specific parameter ("dose", "duration", "timing", etc.) when CONTRADICTED.
6. Be conservative on CONTRADICTED. If you cannot point to specific text in the reference that conflicts, choose SUPPORTED instead.

Return ONLY a JSON object in this exact shape:
{
  "status": "SUPPORTED" | "CONTRADICTED" | "UNSUPPORTED",
  "explanation": "...",
  "citation_quote": "..." | null
}

No other text, no markdown, no preamble.`;

@Injectable()
export class VerifyStage {
  private readonly logger = new Logger(VerifyStage.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly retrieval: RetrievalService,
  ) {}

  async run(ctx: PipelineContext): Promise<void> {
    const entities = await this.prisma.entity.findMany({
      where: { jobId: ctx.jobId },
      include: { flag: true },
      orderBy: { createdAt: 'asc' },
    });

    if (entities.length === 0) {
      this.logger.warn(
        structuredLog('pipeline.verification.skipped', {
          jobId: ctx.jobId,
          primaryDocumentId: ctx.primaryDocumentId,
          referenceDocumentId: ctx.referenceDocumentId,
          reason: 'no_entities',
        }),
      );
      return;
    }

    let supported = 0;
    let contradicted = 0;
    let unsupported = 0;

    for (const entity of entities) {
      if (entity.flag) {
        this.logger.debug(`VERIFY skipped for ${entity.drugName}: flag exists (idempotency)`);
        continue;
      }

      try {
        const verdict = await this.verifyOne(ctx, entity);
        await this.persistFlag(entity.id, verdict);

        if (verdict.status === FlagStatus.SUPPORTED) supported++;
        else if (verdict.status === FlagStatus.CONTRADICTED) contradicted++;
        else unsupported++;
      } catch (e) {
        // Per-entity failure: log, mark as UNSUPPORTED with the error, continue.
        // We DON'T fail the whole stage — partial verification is more useful
        // than no verification at all.
        const message = (e as Error).message ?? 'Unknown error';
        this.logger.error(
          structuredLog('pipeline.verification.entity_failed', {
            jobId: ctx.jobId,
            entityId: entity.id,
            drugName: entity.drugName,
            error: message,
          }),
        );
        await this.persistFlag(entity.id, {
          status: FlagStatus.UNSUPPORTED,
          explanation: `Verification could not be completed: ${message}`,
          citationChunkId: null,
          citationText: null,
          citationSection: null,
          citationPage: null,
        });
        unsupported++;
      }
    }

    this.logger.log(
      structuredLog('pipeline.verification.completed', {
        jobId: ctx.jobId,
        primaryDocumentId: ctx.primaryDocumentId,
        referenceDocumentId: ctx.referenceDocumentId,
        entityCount: entities.length,
        supportedCount: supported,
        contradictedCount: contradicted,
        unsupportedCount: unsupported,
      }),
    );
  }

  // ──────────────── per-entity verification ────────────────

  private async verifyOne(
    ctx: PipelineContext,
    entity: Entity,
  ): Promise<PersistableVerdict> {
    // 1. Build a focused retrieval query — name + dose/frequency/duration so the
    //    embedding lands close to the right monograph even if the drug isn't named.
    const query = this.buildQuery(entity);
    const chunks = await this.retrieval.retrieve({
      documentId: ctx.referenceDocumentId,
      query,
      topK: TOP_K_RETRIEVAL,
    });

    // 2. Relevance gate: if even the closest chunk is far away, the drug isn't
    //    in the formulary. Short-circuit to UNSUPPORTED — saves an LLM call.
    if (chunks.length === 0 || chunks[0].distance > RELEVANCE_DISTANCE_THRESHOLD) {
      const topDist = chunks[0]?.distance.toFixed(3) ?? 'n/a';
      this.logger.log(
        structuredLog('pipeline.verification.entity_relevance_gated', {
          jobId: ctx.jobId,
          entityId: entity.id,
          drugName: entity.drugName,
          topDistance: topDist,
          threshold: RELEVANCE_DISTANCE_THRESHOLD,
          verdict: FlagStatus.UNSUPPORTED,
        }),
      );
      return {
        status: FlagStatus.UNSUPPORTED,
        explanation: `No monograph for "${entity.drugName}" was found in the institutional formulary. The closest reference entries did not match this drug (cosine distance ${topDist}).`,
        citationChunkId: null,
        citationText: null,
        citationSection: null,
        citationPage: null,
      };
    }

    // 3. Call the LLM with the retrieved chunks
    const llmRaw = await this.llm.completeJson<unknown>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: this.buildUserPrompt(entity, chunks),
      maxTokens: 600,
      temperature: 0,
    });

    const parsed = VerifyOutputSchema.safeParse(llmRaw);
    if (!parsed.success) {
      throw new Error(
        `Verification LLM returned malformed JSON: ${parsed.error.message}`,
      );
    }
    const out = parsed.data;

    // 4. Validate the citation: it must appear in one of the retrieved chunks.
    //    If LLM says CONTRADICTED but the citation isn't grounded → downgrade
    //    to UNSUPPORTED so the user never sees a "contradicted because of
    //    [fabricated quote]" message.
    let citationChunk: RetrievedChunk | null = null;
    let citationText: string | null = null;

    if (out.citation_quote) {
      citationChunk = this.findCitationChunk(out.citation_quote, chunks);
      if (citationChunk) {
        citationText = out.citation_quote.trim();
      } else if (out.status === 'CONTRADICTED') {
        this.logger.warn(
          structuredLog('pipeline.verification.entity_downgraded', {
            jobId: ctx.jobId,
            entityId: entity.id,
            drugName: entity.drugName,
            reason: 'citation_not_grounded',
            initialVerdict: 'CONTRADICTED',
            finalVerdict: FlagStatus.UNSUPPORTED,
          }),
        );
        return {
          status: FlagStatus.UNSUPPORTED,
          explanation: `Verification produced a contradiction verdict that could not be grounded in the retrieved reference passages. Treating as unsupported pending manual review.`,
          citationChunkId: null,
          citationText: null,
          citationSection: null,
          citationPage: null,
        };
      }
    }

    this.logger.log(
      structuredLog('pipeline.verification.entity_completed', {
        jobId: ctx.jobId,
        entityId: entity.id,
        drugName: entity.drugName,
        verdict: out.status,
        topMonograph: chunks[0].monograph ?? null,
        topDistance: Number(chunks[0].distance.toFixed(3)),
        citationGrounded: Boolean(citationChunk),
      }),
    );

    return {
      status: out.status as FlagStatus,
      explanation: out.explanation,
      citationChunkId: citationChunk?.id ?? null,
      citationText,
      citationSection: citationChunk?.section ?? null,
      citationPage: citationChunk?.page ?? null,
    };
  }

  // ──────────────── helpers ────────────────

  /**
   * Compose a retrieval query that includes everything the entity prescribes.
   * Including dose + frequency + duration steers the embedding toward the
   * specific parameters the monograph addresses, not just the drug name.
   */
  private buildQuery(entity: Entity): string {
    const parts = [entity.drugName];
    if (entity.dose) parts.push(`${entity.dose}${entity.unit ?? ''}`);
    if (entity.frequency) parts.push(entity.frequency);
    if (entity.duration) parts.push(`for ${entity.duration}`);
    if (entity.indication) parts.push(`for ${entity.indication}`);
    return parts.join(' ');
  }

  private buildUserPrompt(entity: Entity, chunks: RetrievedChunk[]): string {
    const prescription = [
      `Drug: ${entity.drugName}`,
      entity.dose && `Dose: ${entity.dose}${entity.unit ?? ''}`,
      entity.route && `Route: ${entity.route}`,
      entity.frequency && `Frequency: ${entity.frequency}`,
      entity.duration && `Duration: ${entity.duration}`,
      entity.indication && `Indication: ${entity.indication}`,
    ]
      .filter(Boolean)
      .join('\n');

    const passages = chunks
      .map(
        (c, i) =>
          `[Passage ${i + 1}${c.monograph ? ` — ${c.monograph}` : ''}${c.section ? ` (${c.section})` : ''}]\n${c.text}`,
      )
      .join('\n\n');

    return `Prescription to verify:
${prescription}

Reference passages retrieved from the institutional formulary:

${passages}`;
  }

  /**
   * Citation grounding: does the LLM's claimed citation actually appear in
   * one of the retrieved chunks? Uses the same normalize-then-substring
   * approach as the extraction stage.
   */
  private findCitationChunk(
    quote: string,
    chunks: RetrievedChunk[],
  ): RetrievedChunk | null {
    const normQuote = this.normalize(quote);
    if (normQuote.length < 10) return null;

    for (const c of chunks) {
      if (this.normalize(c.text).includes(normQuote)) return c;
    }
    return null;
  }

  private normalize(s: string): string {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async persistFlag(
    entityId: string,
    verdict: PersistableVerdict,
  ): Promise<void> {
    await this.prisma.flag.create({
      data: {
        entityId,
        status: verdict.status,
        explanation: verdict.explanation,
        citationChunkId: verdict.citationChunkId,
        citationText: verdict.citationText,
        citationSection: verdict.citationSection,
        citationPage: verdict.citationPage,
      },
    });
  }
}

interface PersistableVerdict {
  status: FlagStatus;
  explanation: string;
  citationChunkId: string | null;
  citationText: string | null;
  citationSection: string | null;
  citationPage: number | null;
}