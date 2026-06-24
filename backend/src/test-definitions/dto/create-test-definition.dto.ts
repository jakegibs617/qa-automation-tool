import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { IsStartUrl } from './start-url.validator';
import { IsTestSteps, TestStepDto } from './test-step.dto';

export class CreateTestDefinitionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUUID()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  @IsStartUrl()
  startUrl!: string;

  @IsTestSteps()
  steps!: TestStepDto[];
}
