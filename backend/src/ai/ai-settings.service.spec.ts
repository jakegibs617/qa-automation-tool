import { Repository } from 'typeorm';
import { IsAllowedOllamaBaseUrlConstraint } from './ai-settings.dto';
import { AiSettings } from './ai-settings.entity';
import { AiSettingsService } from './ai-settings.service';

const now = new Date('2026-06-27T12:00:00.000Z');

const settingsRow = (overrides: Partial<AiSettings> = {}): AiSettings => ({
  id: 'default',
  provider: 'anthropic',
  model: 'claude-test',
  anthropicApiKey: 'secret-key',
  ollamaBaseUrl: 'http://localhost:11434',
  enabled: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const setup = (initial: AiSettings | null = settingsRow()) => {
  let row = initial;
  const repository = {
    findOneBy: jest.fn().mockImplementation(async () => row),
    create: jest.fn().mockImplementation((value) => settingsRow(value)),
    save: jest.fn().mockImplementation(async (value) => {
      row = settingsRow(value);
      return row;
    }),
  } as Pick<Repository<AiSettings>, 'findOneBy' | 'create' | 'save'> as Repository<AiSettings>;

  return { service: new AiSettingsService(repository), repository };
};

describe('AiSettingsService', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
  });

  it('redacts saved Anthropic API keys from settings responses', async () => {
    const { service } = setup(settingsRow({ anthropicApiKey: 'super-secret' }));

    const result = await service.getSettings();

    expect(result.hasAnthropicApiKey).toBe(true);
    expect(result.hasSavedAnthropicApiKey).toBe(true);
    expect(JSON.stringify(result)).not.toContain('super-secret');
  });

  it('reports env fallback keys without exposing the value', async () => {
    process.env.ANTHROPIC_API_KEY = 'env-secret';
    const { service } = setup(settingsRow({ anthropicApiKey: null }));

    const result = await service.getSettings();

    expect(result.hasAnthropicApiKey).toBe(true);
    expect(result.hasSavedAnthropicApiKey).toBe(false);
    expect(result.usesEnvAnthropicApiKey).toBe(true);
    expect(JSON.stringify(result)).not.toContain('env-secret');
  });

  it('saves Ollama settings with a default local base URL', async () => {
    const { service } = setup(settingsRow());

    const result = await service.updateSettings({
      provider: 'ollama',
      model: 'llama3.1',
      enabled: true,
    });

    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('llama3.1');
    expect(result.ollamaBaseUrl).toBe('http://localhost:11434');
  });

  it('does not erase a saved Anthropic key when the update omits the key field', async () => {
    const { service } = setup(settingsRow({ anthropicApiKey: 'keep-me' }));

    await service.updateSettings({
      provider: 'anthropic',
      model: 'claude-next',
      enabled: true,
    });
    const effective = await service.getEffectiveSettings();

    expect(effective.anthropicApiKey).toBe('keep-me');
  });

  it('uses saved secrets when building transient settings for connection tests', async () => {
    const { service } = setup(
      settingsRow({
        anthropicApiKey: 'saved-key',
        ollamaBaseUrl: 'http://host.docker.internal:11434',
      }),
    );

    const effective = await service.getEffectiveSettingsForTest({
      provider: 'anthropic',
      model: 'claude-test',
      enabled: true,
    });

    expect(effective.anthropicApiKey).toBe('saved-key');
    expect(effective.ollamaBaseUrl).toBe('http://host.docker.internal:11434');
    expect(effective.enabled).toBe(true);
  });

  it('allows only local Ollama base URLs', () => {
    const validator = new IsAllowedOllamaBaseUrlConstraint();

    expect(validator.validate('http://localhost:11434')).toBe(true);
    expect(validator.validate('http://host.docker.internal:11434')).toBe(true);
    expect(validator.validate('http://localhost:9200')).toBe(false);
    expect(validator.validate('http://localhost:11434/admin')).toBe(false);
    expect(validator.validate('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(validator.validate('ftp://localhost:11434')).toBe(false);
    expect(validator.validate('http://user:pass@localhost:11434')).toBe(false);
  });
});
