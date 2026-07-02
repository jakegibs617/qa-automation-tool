import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AiProviderAdapter } from './ai-provider-adapter';
import { EffectiveAiSettings } from './ai-settings.service';
import { OUTPUT_SCHEMA, SYSTEM_PROMPT } from './generation-prompt';

@Injectable()
export class OllamaProviderAdapter implements AiProviderAdapter {
  readonly provider = 'ollama' as const;

  isConfigured(settings: EffectiveAiSettings): boolean {
    return Boolean(settings.ollamaBaseUrl && settings.model);
  }

  async generateText(
    settings: EffectiveAiSettings,
    userPrompt: string,
  ): Promise<string> {
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

    return record.response;
  }
}
