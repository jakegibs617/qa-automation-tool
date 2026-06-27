import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { AiProvider } from './ai-settings.entity';

export const aiProviders: AiProvider[] = ['anthropic', 'ollama'];

const allowedOllamaHosts = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  'host.docker.internal',
]);

export function isAllowedOllamaBaseUrl(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  if (typeof value !== 'string') {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.protocol === 'http:' &&
      allowedOllamaHosts.has(url.hostname.toLowerCase()) &&
      (url.port === '11434' || url.port === '') &&
      (url.pathname === '' || url.pathname === '/') &&
      url.search === '' &&
      url.hash === '' &&
      url.username === '' &&
      url.password === ''
    );
  } catch {
    return false;
  }
}

@ValidatorConstraint({ name: 'isAllowedOllamaBaseUrl', async: false })
export class IsAllowedOllamaBaseUrlConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown) {
    return isAllowedOllamaBaseUrl(value);
  }

  defaultMessage() {
    return 'ollamaBaseUrl must be a local Ollama URL such as http://localhost:11434 or http://host.docker.internal:11434';
  }
}

export class UpdateAiSettingsDto {
  @IsIn(aiProviders)
  provider!: AiProvider;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  model!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  anthropicApiKey?: string | null;

  @IsOptional()
  @Validate(IsAllowedOllamaBaseUrlConstraint)
  @MaxLength(500)
  ollamaBaseUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TestAiSettingsDto extends UpdateAiSettingsDto {}
