import { Module } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiSettings } from './ai-settings.entity';
import { AiSettingsService } from './ai-settings.service';
import { IsAllowedOllamaBaseUrlConstraint } from './ai-settings.dto';
import { AiController } from './ai.controller';
import { AI_PROVIDER_ADAPTERS } from './ai-provider-adapter';
import {
  ANTHROPIC_FACTORY,
  AnthropicFactory,
  AnthropicProviderAdapter,
} from './anthropic-provider.adapter';
import { OllamaProviderAdapter } from './ollama-provider.adapter';
import { AiTestGenerationService } from './ai-test-generation.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiSettings])],
  controllers: [AiController],
  providers: [
    {
      provide: ANTHROPIC_FACTORY,
      useFactory: (): AnthropicFactory => (apiKey: string) => new Anthropic({ apiKey }),
    },
    AnthropicProviderAdapter,
    OllamaProviderAdapter,
    {
      provide: AI_PROVIDER_ADAPTERS,
      useFactory: (anthropic: AnthropicProviderAdapter, ollama: OllamaProviderAdapter) => [
        anthropic,
        ollama,
      ],
      inject: [AnthropicProviderAdapter, OllamaProviderAdapter],
    },
    IsAllowedOllamaBaseUrlConstraint,
    AiSettingsService,
    AiTestGenerationService,
  ],
})
export class AiModule {}
