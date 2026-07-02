import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AiSettingsService, EffectiveAiSettings } from './ai-settings.service';
import { AI_PROVIDER_ADAPTERS, AiProviderAdapter } from './ai-provider-adapter';
import { TestStepDto, validateTestStep } from '../test-definitions/dto/test-step.dto';

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

/**
 * Generates structured test steps from a natural-language prompt using the
 * runtime-configured AI provider. Provider transport lives behind
 * AiProviderAdapter implementations; this service owns the shared workflow:
 * prompt construction, response validation, and base-URL scoping.
 */
@Injectable()
export class AiTestGenerationService {
  private readonly logger = new Logger(AiTestGenerationService.name);

  constructor(
    private readonly settingsService: AiSettingsService,
    @Inject(AI_PROVIDER_ADAPTERS)
    private readonly providerAdapters: AiProviderAdapter[],
  ) {}

  async isConfigured(): Promise<boolean> {
    const settings = await this.settingsService.getEffectiveSettings();
    if (!settings.enabled) {
      return false;
    }
    return this.adapterFor(settings.provider)?.isConfigured(settings) ?? false;
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

  private adapterFor(provider: string): AiProviderAdapter | null {
    return this.providerAdapters.find((adapter) => adapter.provider === provider) ?? null;
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

    const adapter = this.adapterFor(settings.provider);
    if (!adapter) {
      throw new BadRequestException('Unsupported AI provider selected.');
    }

    const userParts = [`Request: ${input.prompt}`];
    if (input.startUrl) userParts.push(`Start URL: ${input.startUrl}`);
    if (input.baseUrl) userParts.push(`Base URL of the site under test: ${input.baseUrl}`);
    const userPrompt = userParts.join('\n');

    const text = await adapter.generateText(settings, userPrompt);
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
