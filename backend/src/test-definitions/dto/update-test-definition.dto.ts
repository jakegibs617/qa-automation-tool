import { IsOptional, IsString } from 'class-validator';
import { IsStartUrl } from './start-url.validator';
import { IsTestSteps, TestStepDto } from './test-step.dto';

export class UpdateTestDefinitionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsStartUrl()
  startUrl?: string;

  @IsOptional()
  @IsTestSteps()
  steps?: TestStepDto[];
}
