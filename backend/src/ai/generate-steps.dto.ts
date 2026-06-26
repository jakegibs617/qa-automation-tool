import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GenerateStepsDto {
  /** Natural-language description of what the test should do. */
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  prompt!: string;

  /** Optional start URL/path hint the model should use for the first navigation. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  startUrl?: string;

  /** Optional base URL of the project under test, to ground relative paths. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  baseUrl?: string;
}
