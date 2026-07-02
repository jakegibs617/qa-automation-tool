import { AiProvider } from './ai-settings.entity';
import { EffectiveAiSettings } from './ai-settings.service';

export const AI_PROVIDER_ADAPTERS = 'AI_PROVIDER_ADAPTERS';

/**
 * One provider's transport boundary: credential presence, the API call, and
 * extraction of the raw JSON text the model produced. Prompt construction,
 * step validation, and base-URL scoping stay centralized in
 * AiTestGenerationService; the shared prompt/schema live in
 * generation-prompt.ts.
 *
 * Adapters map their own transport failures to HTTP exceptions:
 * ServiceUnavailableException for unreachable/misconfigured providers,
 * UnprocessableEntityException for unusable model output.
 */
export interface AiProviderAdapter {
  readonly provider: AiProvider;
  isConfigured(settings: EffectiveAiSettings): boolean;
  generateText(settings: EffectiveAiSettings, userPrompt: string): Promise<string>;
}
