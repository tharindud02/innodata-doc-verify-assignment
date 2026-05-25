import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type LlmProvider = 'openai' | 'anthropic';

export interface LlmCallOptions {
  systemPrompt: string;
  userPrompt: string;
  /** Hard cap on output tokens. Keep tight to fail fast on runaway outputs. */
  maxTokens?: number;
  /** 0 for deterministic JSON extraction, 0.3 for prose summaries. */
  temperature?: number;
  /** Optional override; defaults to OPENAI_MODEL / ANTHROPIC_MODEL env. */
  model?: string;
}

export interface LlmCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly provider: LlmProvider;
  private readonly anthropic?: Anthropic;
  private readonly openai?: OpenAI;
  private readonly defaultModel: string;

  constructor(private readonly config: ConfigService) {
    this.provider = this.resolveProvider();

    if (this.provider === 'openai') {
      const apiKey = this.config.getOrThrow<string>('OPENAI_API_KEY').trim();
      this.openai = new OpenAI({ apiKey });
      this.defaultModel = this.config.get<string>('OPENAI_MODEL', 'gpt-4o');
      this.logger.log(`LLM provider: OpenAI (model=${this.defaultModel})`);
    } else {
      const apiKey = this.config.getOrThrow<string>('ANTHROPIC_API_KEY').trim();
      const authToken = this.config.get<string>('ANTHROPIC_AUTH_TOKEN')?.trim();
      const baseURL = this.config.get<string>('ANTHROPIC_BASE_URL')?.trim();
      this.anthropic = new Anthropic({
        apiKey,
        ...(authToken ? { authToken } : {}),
        ...(baseURL ? { baseURL } : {}),
      });
      this.defaultModel = this.config.get<string>(
        'ANTHROPIC_MODEL',
        'claude-opus-4-6',
      );
      this.logger.log(
        `LLM provider: Anthropic (model=${this.defaultModel}${baseURL ? `, base=${baseURL}` : ''})`,
      );
    }
  }

  /**
   * Single text-in, text-out completion. All stage prompts go through here so
   * we have one place to add: logging, retries, prompt caching, token budgets.
   */
  async complete(opts: LlmCallOptions): Promise<LlmCallResult> {
    const model = opts.model ?? this.defaultModel;
    const start = Date.now();

    if (this.provider === 'openai') {
      return this.completeOpenAi(opts, model, start);
    }
    return this.completeAnthropic(opts, model, start);
  }

  /**
   * Same as complete(), but expects a JSON object as the output and parses it.
   * The system prompt should require the model to emit JSON only.
   * On parse failure we fall through to a strict-JSON re-extraction.
   */
  async completeJson<T>(opts: LlmCallOptions): Promise<T> {
    const result = await this.complete(opts);
    return this.parseJsonOutput<T>(result.text);
  }

  private resolveProvider(): LlmProvider {
    const explicit = this.config.get<string>('LLM_PROVIDER')?.trim().toLowerCase();
    if (explicit === 'openai' || explicit === 'anthropic') {
      return explicit;
    }
    if (this.config.get<string>('OPENAI_API_KEY')?.trim()) {
      return 'openai';
    }
    return 'anthropic';
  }

  private async completeOpenAi(
    opts: LlmCallOptions,
    model: string,
    start: number,
  ): Promise<LlmCallResult> {
    if (!this.openai) {
      throw new Error('OpenAI client not configured');
    }

    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await this.openai.chat.completions.create({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0,
        messages: [
          { role: 'system', content: opts.systemPrompt },
          { role: 'user', content: opts.userPrompt },
        ],
      });
    } catch (e) {
      if (e instanceof OpenAI.APIError && e.status === 401) {
        throw new Error(
          'OpenAI API authentication failed - check OPENAI_API_KEY in root .env',
        );
      }
      throw e;
    }

    const durationMs = Date.now() - start;
    const text = response.choices[0]?.message?.content?.trim() ?? '';
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    this.logger.log(
      `LLM call (${model}): in=${inputTokens} out=${outputTokens} ${durationMs}ms`,
    );

    return { text, inputTokens, outputTokens, durationMs };
  }

  private async completeAnthropic(
    opts: LlmCallOptions,
    model: string,
    start: number,
  ): Promise<LlmCallResult> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not configured');
    }

    let response: Anthropic.Message;
    try {
      response = await this.anthropic.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0,
        system: opts.systemPrompt,
        messages: [{ role: 'user', content: opts.userPrompt }],
      });
    } catch (e) {
      if (e instanceof Anthropic.APIError && e.status === 401) {
        const body = e.error as { type?: string } | undefined;
        if (body?.type === 'unauthorized_client_error') {
          throw new Error(
            'AgentRouter rejected this client (unauthorized client detected). Use OpenAI (OPENAI_API_KEY) or direct Anthropic (sk-ant-...).',
          );
        }
        throw new Error(
          'Anthropic API authentication failed - check ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL in root .env',
        );
      }
      throw e;
    }

    const durationMs = Date.now() - start;
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    this.logger.log(
      `LLM call (${model}): in=${inputTokens} out=${outputTokens} ${durationMs}ms`,
    );

    return { text, inputTokens, outputTokens, durationMs };
  }

  /**
   * Best-effort JSON extraction:
   *  1. Try parsing the raw text.
   *  2. If that fails, look for the first {...} or [...] balanced block.
   *  3. If still failing, throw with a helpful message.
   */
  private parseJsonOutput<T>(raw: string): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
      if (fenced) {
        try {
          return JSON.parse(fenced[1]) as T;
        } catch {
          /* fall through */
        }
      }
      const firstObj = raw.indexOf('{');
      const firstArr = raw.indexOf('[');
      const start =
        firstObj === -1
          ? firstArr
          : firstArr === -1
            ? firstObj
            : Math.min(firstObj, firstArr);
      if (start >= 0) {
        const candidate = raw.slice(start);
        try {
          return JSON.parse(candidate) as T;
        } catch {
          /* fall through */
        }
      }
      this.logger.error(`Failed to parse LLM JSON output: ${raw.slice(0, 200)}`);
      throw new Error('LLM returned non-JSON output');
    }
  }
}
