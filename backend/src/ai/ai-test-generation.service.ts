import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import {
  supportedStepTypes,
  TestStepDto,
  validateTestStep,
} from '../test-definitions/dto/test-step.dto';

export const ANTHROPIC_CLIENT = 'ANTHROPIC_CLIENT';

export type GenerateStepsInput = {
  prompt: string;
  startUrl?: string;
  baseUrl?: string;
};

export type GeneratedTest = {
  name: string;
  startUrl: string;
  steps: TestStepDto[];
};

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8';

// JSON-schema-constrained output: the model must return exactly this shape.
// Per-type field requirements are enforced afterwards by validateTestStep.
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    startUrl: { type: 'string' },
    steps: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...supportedStepTypes] },
          url: { type: 'string' },
          selector: { type: 'string' },
          value: { type: 'string' },
          key: { type: 'string' },
          text: { type: 'string' },
          timeoutMs: { type: 'integer' },
        },
        required: ['type'],
        additionalProperties: false,
      },
    },
  },
  required: ['name', 'startUrl', 'steps'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You convert a plain-language QA testing request into a structured browser test for a Playwright-based runner.

Output a JSON object with: a short "name" (a few words), a "startUrl" (a path like "/login" or an absolute URL; use the provided startUrl when given, otherwise "/"), and an ordered "steps" array.

Each step has a "type" and only the fields that type needs:
- goto: { type, url }
- click: { type, selector }
- fill: { type, selector, value }
- press: { type, selector, key }       // key is a keyboard key like "Enter"
- select: { type, selector, value }
- wait: { type, timeoutMs }            // timeoutMs is an optional non-negative integer
- assertText: { type, selector, text } // text is expected substring
- assertVisible: { type, selector }
- assertUrl: { type, url }

Selector guidance — prefer resilient selectors in this order: data-testid, aria-label, role, visible text, then CSS. Avoid brittle deep CSS/XPath. Do not invent steps the request does not imply. Keep the test minimal and focused on what was asked.`;

/**
 * Generates structured test steps from a natural-language prompt using Claude.
 * The client is injected (null when ANTHROPIC_API_KEY is unset) so the app
 * boots without a key; generation then fails with a clear, actionable error.
 */
@Injectable()
export class AiTestGenerationService {
  private readonly logger = new Logger(AiTestGenerationService.name);

  constructor(
    @Inject(ANTHROPIC_CLIENT) private readonly anthropic: Anthropic | null,
  ) {}

  isConfigured(): boolean {
    return this.anthropic !== null;
  }

  async generate(input: GenerateStepsInput): Promise<GeneratedTest> {
    if (!this.anthropic) {
      throw new ServiceUnavailableException(
        'AI test generation is not configured. Set ANTHROPIC_API_KEY in the backend environment.',
      );
    }

    const userParts = [`Request: ${input.prompt}`];
    if (input.startUrl) userParts.push(`Start URL: ${input.startUrl}`);
    if (input.baseUrl) userParts.push(`Base URL of the site under test: ${input.baseUrl}`);

    const response = await this.anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
      },
      messages: [{ role: 'user', content: userParts.join('\n') }],
    });

    if (response.stop_reason === 'refusal') {
      throw new UnprocessableEntityException(
        'The model declined to generate steps for this request.',
      );
    }

    const text = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    )?.text;

    if (!text) {
      throw new UnprocessableEntityException('The model returned no usable output.');
    }

    return this.parseAndValidate(text, input);
  }

  private parseAndValidate(text: string, input: GenerateStepsInput): GeneratedTest {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new UnprocessableEntityException('The model returned malformed JSON.');
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new UnprocessableEntityException('The model returned an unexpected shape.');
    }

    const record = parsed as Record<string, unknown>;
    const rawSteps = Array.isArray(record.steps) ? record.steps : [];

    // Keep only steps that satisfy the runner's own per-type rules; a model
    // slip on one step shouldn't poison the whole generation.
    const steps = rawSteps.filter(validateTestStep);
    if (steps.length === 0) {
      throw new UnprocessableEntityException(
        'The model did not produce any valid test steps. Try rephrasing the request.',
      );
    }
    if (steps.length < rawSteps.length) {
      this.logger.warn(
        `Dropped ${rawSteps.length - steps.length} invalid generated step(s).`,
      );
    }

    const name =
      typeof record.name === 'string' && record.name.trim().length > 0
        ? record.name.trim()
        : 'Generated test';
    const startUrl =
      typeof record.startUrl === 'string' && record.startUrl.trim().length > 0
        ? record.startUrl.trim()
        : input.startUrl ?? '/';

    return { name, startUrl, steps };
  }
}
