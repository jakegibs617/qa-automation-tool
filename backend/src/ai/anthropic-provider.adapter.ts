import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AiProviderAdapter } from './ai-provider-adapter';
import { EffectiveAiSettings } from './ai-settings.service';
import { OUTPUT_SCHEMA, SYSTEM_PROMPT } from './generation-prompt';

export const ANTHROPIC_FACTORY = 'ANTHROPIC_FACTORY';

export type AnthropicFactory = (apiKey: string) => Anthropic;

@Injectable()
export class AnthropicProviderAdapter implements AiProviderAdapter {
  readonly provider = 'anthropic' as const;

  constructor(
    @Inject(ANTHROPIC_FACTORY) private readonly anthropicFactory: AnthropicFactory,
  ) {}

  isConfigured(settings: EffectiveAiSettings): boolean {
    return Boolean(settings.anthropicApiKey);
  }

  async generateText(
    settings: EffectiveAiSettings,
    userPrompt: string,
  ): Promise<string> {
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

    return text;
  }
}
