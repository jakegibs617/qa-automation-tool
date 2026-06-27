import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';
import { TestAiSettingsDto, UpdateAiSettingsDto } from './ai-settings.dto';
import { AiTestGenerationService } from './ai-test-generation.service';
import { GenerateStepsDto } from './generate-steps.dto';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiTestGenerationService,
    private readonly settingsService: AiSettingsService,
  ) {}

  @Get('settings')
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateAiSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }

  @Post('settings/test')
  async testSettings(@Body() dto: TestAiSettingsDto) {
    return this.aiService.testConnection(
      await this.settingsService.getEffectiveSettingsForTest(dto),
    );
  }

  /** Generate structured test steps from a natural-language prompt for review/edit. */
  @Post('generate-steps')
  generateSteps(@Body() dto: GenerateStepsDto) {
    return this.aiService.generate(dto);
  }
}
