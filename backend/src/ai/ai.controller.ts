import { Body, Controller, Post } from '@nestjs/common';
import { AiTestGenerationService } from './ai-test-generation.service';
import { GenerateStepsDto } from './generate-steps.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiTestGenerationService) {}

  /** Generate structured test steps from a natural-language prompt for review/edit. */
  @Post('generate-steps')
  generateSteps(@Body() dto: GenerateStepsDto) {
    return this.aiService.generate(dto);
  }
}
