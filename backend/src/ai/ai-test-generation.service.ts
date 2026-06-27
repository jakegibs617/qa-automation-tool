import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AiSettingsService, EffectiveAiSettings } from './ai-settings.service';
import {
  supportedStepTypes,
  TestStepDto,
  validateTestStep,
} from '../test-definitions/dto/test-step.dto';

export const ANTHROPIC_FACTORY = 'ANTHROPIC_FACTORY';

export type AnthropicFactory = (apiKey: string) => Anthropic;

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
 * Generates structured test steps from a natural-language prompt using the
 * runtime-configured AI provider.
 */
@Injectable()
export class AiTestGenerationService {
  private readonly logger = new Logger(AiTestGenerationService.name);

  constructor(
    private readonly settingsService: AiSettingsService,
    @Inject(ANTHROPIC_FACTORY) private readonly anthropicFactory: AnthropicFactory,
  ) {}

  async isConfigured(): Promise<boolean> {
    const settings = await this.settingsService.getEffectiveSettings();
    return settings.enabled && this.hasProviderConfiguration(settings);
  }

  async generate(input: GenerateStepsInput): Promise<GeneratedTest> {
    return this.generateWithSettings(input, await this.settingsService.getEffectiveSettings());
  }

  async testConnection(settings: EffectiveAiSettings) {
    await this.generateWithSettings(
      {
        prompt: 'Create one minimal test that opens the home page and verifies the body is visible.',
        startUrl: '/',
      },
      settings,
    );

    return {
      ok: true,
      provider: settings.provider,
      model: settings.model,
      message: `${settings.provider} responded with valid test steps.`,
    };
  }

  private async generateWithSettings(
    input: GenerateStepsInput,
    settings: EffectiveAiSettings,
  ): Promise<GeneratedTest> {
    if (!settings.enabled) {
      throw new ServiceUnavailableException(
        'AI test generation is disabled in AI settings.',
      );
    }

    const userParts = [`Request: ${input.prompt}`];
    if (input.startUrl) userParts.push(`Start URL: ${input.startUrl}`);
    if (input.baseUrl) userParts.push(`Base URL of the site under test: ${input.baseUrl}`);
    const userPrompt = userParts.join('\n');

    if (settings.provider === 'anthropic') {
      return this.generateWithAnthropic(settings, userPrompt, input);
    }
    if (settings.provider === 'ollama') {
      return this.generateWithOllama(settings, userPrompt, input);
    }

    throw new BadRequestException('Unsupported AI provider selected.');
  }

  private async generateWithAnthropic(
    settings: EffectiveAiSettings,
    userPrompt: string,
    input: GenerateStepsInput,
  ): Promise<GeneratedTest> {
    if (!settings.anthropicApiKey) {
      throw new ServiceUnavailableException(
        'Anthropic is not configured. Save an Anthropic API key in AI settings.',
      );
    }

    const anthropic = this.anthropicFactory(settings.anthropicApiKey);
    const response = await anthropic.messages.create({
      model: settings.model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
      },
      messages: [{ role: 'user', content: userPrompt }],
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

  private async generateWithOllama(
    settings: EffectiveAiSettings,
    userPrompt: string,
    input: GenerateStepsInput,
  ): Promise<GeneratedTest> {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      response = await fetch(`${settings.ollamaBaseUrl.replace(/\/+$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: settings.model,
          system: SYSTEM_PROMPT,
          prompt: userPrompt,
          stream: false,
          format: OUTPUT_SCHEMA,
        }),
      });
    } catch {
      throw new ServiceUnavailableException(
        `Unable to reach Ollama at ${settings.ollamaBaseUrl}. Confirm Ollama is running and the base URL is correct.`,
      );
    } finally {
      clearTimeout(timeout);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ServiceUnavailableException('Ollama returned a non-JSON response.');
    }

    const record = body as Record<string, unknown>;
    if (!response.ok || typeof record.error === 'string') {
      const detail = typeof record.error === 'string' ? ` ${record.error}` : '';
      throw new ServiceUnavailableException(`Ollama generation failed.${detail}`);
    }

    if (typeof record.response !== 'string' || record.response.trim().length === 0) {
      throw new UnprocessableEntityException('Ollama returned no usable output.');
    }

    return this.parseAndValidate(record.response, input);
  }

  private hasProviderConfiguration(settings: EffectiveAiSettings) {
    if (settings.provider === 'anthropic') {
      return Boolean(settings.anthropicApiKey);
    }
    if (settings.provider === 'ollama') {
      return Boolean(settings.ollamaBaseUrl && settings.model);
    }
    return false;
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

    // Keep only steps that satisfy the runner's own per-type rules and, when a
    // project base URL is available, do not navigate outside that origin.
    const steps = rawSteps.filter(
      (step): step is TestStepDto =>
        validateTestStep(step) && this.isStepScopedToBaseUrl(step, input.baseUrl),
    );
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
        ? this.safeGeneratedUrl(record.startUrl.trim(), input.baseUrl) ??
          input.startUrl ??
          '/'
        : input.startUrl ?? '/';

    return { name, startUrl, steps };
  }

  private isStepScopedToBaseUrl(step: TestStepDto, baseUrl: string | undefined) {
    if ((step.type !== 'goto' && step.type !== 'assertUrl') || !step.url) {
      return true;
    }

    return this.safeGeneratedUrl(step.url, baseUrl) !== null;
  }

  private safeGeneratedUrl(value: string, baseUrl: string | undefined) {
    if (!baseUrl) {
      return value;
    }

    const projectOrigin = parseOrigin(baseUrl);
    if (!projectOrigin || !looksAbsoluteUrl(value)) {
      return value;
    }

    return parseOrigin(value) === projectOrigin ? value : null;
  }
}

function looksAbsoluteUrl(value: string) {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(value);
}

function parseOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
