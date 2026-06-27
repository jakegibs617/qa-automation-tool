import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProvider, AiSettings } from './ai-settings.entity';
import { isAllowedOllamaBaseUrl, UpdateAiSettingsDto } from './ai-settings.dto';

export const AI_SETTINGS_ID = 'default';
export const DEFAULT_ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
export const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';
const FALLBACK_OLLAMA_BASE_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_BASE_URL =
  normalizeOllamaBaseUrl(process.env.OLLAMA_BASE_URL) || FALLBACK_OLLAMA_BASE_URL;

export type RedactedAiSettings = {
  provider: AiProvider;
  model: string;
  ollamaBaseUrl: string | null;
  enabled: boolean;
  hasAnthropicApiKey: boolean;
  hasSavedAnthropicApiKey: boolean;
  usesEnvAnthropicApiKey: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type EffectiveAiSettings = {
  provider: AiProvider;
  model: string;
  anthropicApiKey: string | null;
  ollamaBaseUrl: string;
  enabled: boolean;
};

@Injectable()
export class AiSettingsService {
  constructor(
    @InjectRepository(AiSettings)
    private readonly settingsRepository: Repository<AiSettings>,
  ) {}

  async getSettings(): Promise<RedactedAiSettings> {
    return this.toRedacted(await this.findOrCreate());
  }

  async getEffectiveSettings(): Promise<EffectiveAiSettings> {
    return this.toEffective(await this.findOrCreate());
  }

  async getEffectiveSettingsForTest(
    dto: UpdateAiSettingsDto,
  ): Promise<EffectiveAiSettings> {
    const saved = await this.findOrCreate();
    const savedEffective = this.toEffective(saved);

    return {
      provider: dto.provider,
      model: dto.model.trim() || defaultModelForProvider(dto.provider),
      anthropicApiKey:
        normalizeNullable(dto.anthropicApiKey) ||
        saved.anthropicApiKey ||
        process.env.ANTHROPIC_API_KEY ||
        null,
      ollamaBaseUrl:
        normalizeOllamaBaseUrl(dto.ollamaBaseUrl) ||
        savedEffective.ollamaBaseUrl ||
        DEFAULT_OLLAMA_BASE_URL,
      enabled: true,
    };
  }

  async updateSettings(dto: UpdateAiSettingsDto): Promise<RedactedAiSettings> {
    const existing = await this.findOrCreate();
    const provider = dto.provider;
    const model = dto.model.trim();

    existing.provider = provider;
    existing.model = model || defaultModelForProvider(provider);
    existing.enabled = dto.enabled ?? true;
    existing.ollamaBaseUrl =
      provider === 'ollama'
        ? normalizeOllamaBaseUrl(dto.ollamaBaseUrl) ?? DEFAULT_OLLAMA_BASE_URL
        : normalizeNullable(dto.ollamaBaseUrl);

    if (dto.anthropicApiKey !== undefined) {
      existing.anthropicApiKey = normalizeNullable(dto.anthropicApiKey);
    }

    return this.toRedacted(await this.settingsRepository.save(existing));
  }

  private async findOrCreate(): Promise<AiSettings> {
    const existing = await this.settingsRepository.findOneBy({ id: AI_SETTINGS_ID });
    if (existing) {
      return existing;
    }

    return this.settingsRepository.save(
      this.settingsRepository.create({
        id: AI_SETTINGS_ID,
        provider: 'anthropic',
        model: DEFAULT_ANTHROPIC_MODEL,
        anthropicApiKey: null,
        ollamaBaseUrl: normalizeOllamaBaseUrl(DEFAULT_OLLAMA_BASE_URL),
        enabled: true,
      }),
    );
  }

  private toEffective(settings: AiSettings): EffectiveAiSettings {
    return {
      provider: settings.provider,
      model: settings.model || defaultModelForProvider(settings.provider),
      anthropicApiKey: settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY || null,
      ollamaBaseUrl: normalizeOllamaBaseUrl(settings.ollamaBaseUrl) || DEFAULT_OLLAMA_BASE_URL,
      enabled: settings.enabled,
    };
  }

  private toRedacted(settings: AiSettings): RedactedAiSettings {
    const usesEnvAnthropicApiKey = Boolean(process.env.ANTHROPIC_API_KEY);
    return {
      provider: settings.provider,
      model: settings.model || defaultModelForProvider(settings.provider),
      ollamaBaseUrl: normalizeOllamaBaseUrl(settings.ollamaBaseUrl) || DEFAULT_OLLAMA_BASE_URL,
      enabled: settings.enabled,
      hasAnthropicApiKey: Boolean(settings.anthropicApiKey || usesEnvAnthropicApiKey),
      hasSavedAnthropicApiKey: Boolean(settings.anthropicApiKey),
      usesEnvAnthropicApiKey,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}

function defaultModelForProvider(provider: AiProvider) {
  return provider === 'ollama' ? DEFAULT_OLLAMA_MODEL : DEFAULT_ANTHROPIC_MODEL;
}

function normalizeNullable(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOllamaBaseUrl(value: string | null | undefined) {
  const normalized = normalizeNullable(value);
  if (!normalized || !isAllowedOllamaBaseUrl(normalized)) {
    return null;
  }

  return normalized.replace(/\/+$/, '');
}
