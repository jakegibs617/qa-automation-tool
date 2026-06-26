import { Module } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AiController } from './ai.controller';
import {
  ANTHROPIC_CLIENT,
  AiTestGenerationService,
} from './ai-test-generation.service';

@Module({
  controllers: [AiController],
  providers: [
    {
      // Null when ANTHROPIC_API_KEY is unset, so the app boots without a key;
      // the service surfaces a clear error at generation time instead.
      provide: ANTHROPIC_CLIENT,
      useFactory: (): Anthropic | null =>
        process.env.ANTHROPIC_API_KEY ? new Anthropic() : null,
    },
    AiTestGenerationService,
  ],
})
export class AiModule {}
