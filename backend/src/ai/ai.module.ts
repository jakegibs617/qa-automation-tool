import { Module } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiSettings } from './ai-settings.entity';
import { AiSettingsService } from './ai-settings.service';
import { IsAllowedOllamaBaseUrlConstraint } from './ai-settings.dto';
import { AiController } from './ai.controller';
import {
  ANTHROPIC_FACTORY,
  AnthropicFactory,
  AiTestGenerationService,
} from './ai-test-generation.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiSettings])],
  controllers: [AiController],
  providers: [
    {
      provide: ANTHROPIC_FACTORY,
      useFactory: (): AnthropicFactory => (apiKey: string) => new Anthropic({ apiKey }),
    },
    IsAllowedOllamaBaseUrlConstraint,
    AiSettingsService,
    AiTestGenerationService,
  ],
})
export class AiModule {}
