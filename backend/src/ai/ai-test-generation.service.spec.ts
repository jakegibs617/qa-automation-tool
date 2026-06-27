import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AiSettingsService, EffectiveAiSettings } from './ai-settings.service';
import { AiTestGenerationService } from './ai-test-generation.service';

const anthropicSettings: EffectiveAiSettings = {
  provider: 'anthropic',
  model: 'claude-test',
  anthropicApiKey: 'test-key',
  ollamaBaseUrl: 'http://localhost:11434',
  enabled: true,
};

const ollamaSettings: EffectiveAiSettings = {
  provider: 'ollama',
  model: 'llama-test',
  anthropicApiKey: null,
  ollamaBaseUrl: 'http://localhost:11434',
  enabled: true,
};

const textResponse = (text: string, stopReason = 'end_turn') => ({
  stop_reason: stopReason,
  content: [{ type: 'text', text }],
});

const generatedJson = JSON.stringify({
  name: 'Login flow',
  startUrl: '/login',
  steps: [
    { type: 'goto', url: '/login' },
    { type: 'fill', selector: '#email', value: 'a@b.com' },
    { type: 'assertText', selector: '#title', text: 'Welcome' },
  ],
});

const setup = (settings: EffectiveAiSettings = anthropicSettings) => {
  const create = jest.fn();
  const settingsService = {
    getEffectiveSettings: jest.fn().mockResolvedValue(settings),
  } as Pick<AiSettingsService, 'getEffectiveSettings'> as AiSettingsService;
  const anthropicFactory = jest.fn().mockReturnValue({ messages: { create } });
  const service = new AiTestGenerationService(settingsService, anthropicFactory);
  return { service, create, anthropicFactory, settingsService };
};

describe('AiTestGenerationService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('reports configured when the selected provider has required settings', async () => {
    const { service } = setup(anthropicSettings);
    await expect(service.isConfigured()).resolves.toBe(true);
  });

  it('reports not configured when Anthropic is selected without an API key', async () => {
    const { service } = setup({ ...anthropicSettings, anthropicApiKey: null });
    await expect(service.isConfigured()).resolves.toBe(false);
  });

  it('uses saved Anthropic settings and sends a schema-constrained request', async () => {
    const { service, create, anthropicFactory } = setup();
    create.mockResolvedValue(textResponse(generatedJson));

    await service.generate({
      prompt: 'log in and reach the dashboard',
      startUrl: '/login',
      baseUrl: 'http://app.test',
    });

    expect(anthropicFactory).toHaveBeenCalledWith('test-key');
    const params = create.mock.calls[0][0];
    expect(params.model).toBe('claude-test');
    expect(params.output_config.format.type).toBe('json_schema');
    expect(params.messages[0].content).toContain('log in and reach the dashboard');
    expect(params.messages[0].content).toContain('/login');
    expect(params.messages[0].content).toContain('http://app.test');
  });

  it('returns the validated name, startUrl, and steps', async () => {
    const { service, create } = setup();
    create.mockResolvedValue(textResponse(generatedJson));

    const result = await service.generate({ prompt: 'log in' });

    expect(result.name).toBe('Login flow');
    expect(result.startUrl).toBe('/login');
    expect(result.steps).toHaveLength(3);
    expect(result.steps[1]).toEqual({
      type: 'fill',
      selector: '#email',
      value: 'a@b.com',
    });
  });

  it('throws a clear error when Anthropic credentials are missing', async () => {
    const { service } = setup({ ...anthropicSettings, anthropicApiKey: null });

    await expect(service.generate({ prompt: 'log in' })).rejects.toThrow(
      'Save an Anthropic API key',
    );
  });

  it('calls Ollama with the saved base URL and model', async () => {
    const { service } = setup(ollamaSettings);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ response: generatedJson }),
    } as never);

    const result = await service.generate({ prompt: 'log in', startUrl: '/login' });

    expect(result.name).toBe('Login flow');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"model":"llama-test"'),
      }),
    );
  });

  it('throws a clear error when Ollama is unreachable', async () => {
    const { service } = setup(ollamaSettings);
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.generate({ prompt: 'log in' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.generate({ prompt: 'log in' })).rejects.toThrow(
      'Unable to reach Ollama',
    );
  });

  it('throws a clear error when Ollama returns an error response', async () => {
    const { service } = setup(ollamaSettings);
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({ error: 'model not found' }),
    } as never);

    await expect(service.generate({ prompt: 'log in' })).rejects.toThrow(
      'model not found',
    );
  });

  it('drops steps that fail per-type validation but keeps valid ones', async () => {
    const { service, create } = setup();
    create.mockResolvedValue(
      textResponse(
        JSON.stringify({
          name: 'Mixed',
          startUrl: '/',
          steps: [
            { type: 'goto', url: '/' },
            { type: 'click' },
            { type: 'assertVisible', selector: '#ok' },
          ],
        }),
      ),
    );

    const result = await service.generate({ prompt: 'do things' });
    expect(result.steps.map((s) => s.type)).toEqual(['goto', 'assertVisible']);
  });

  it('keeps same-origin absolute generated URLs when a project base URL is provided', async () => {
    const { service, create } = setup();
    create.mockResolvedValue(
      textResponse(
        JSON.stringify({
          name: 'Same origin',
          startUrl: 'https://app.test/login',
          steps: [
            { type: 'goto', url: 'https://app.test/login' },
            { type: 'assertUrl', url: 'https://app.test/dashboard' },
          ],
        }),
      ),
    );

    const result = await service.generate({
      prompt: 'log in',
      baseUrl: 'https://app.test',
    });

    expect(result.startUrl).toBe('https://app.test/login');
    expect(result.steps).toHaveLength(2);
  });

  it('drops generated navigation URLs outside the project origin', async () => {
    const { service, create } = setup();
    create.mockResolvedValue(
      textResponse(
        JSON.stringify({
          name: 'External',
          startUrl: 'https://evil.test/login',
          steps: [
            { type: 'goto', url: 'https://evil.test/login' },
            { type: 'goto', url: '/safe' },
            { type: 'assertUrl', url: 'https://evil.test/done' },
            { type: 'assertVisible', selector: '#ok' },
          ],
        }),
      ),
    );

    const result = await service.generate({
      prompt: 'stay in project',
      startUrl: '/fallback',
      baseUrl: 'https://app.test',
    });

    expect(result.startUrl).toBe('/fallback');
    expect(result.steps).toEqual([
      { type: 'goto', url: '/safe' },
      { type: 'assertVisible', selector: '#ok' },
    ]);
  });

  it('throws when no generated steps are valid', async () => {
    const { service, create } = setup();
    create.mockResolvedValue(
      textResponse(JSON.stringify({ name: 'x', startUrl: '/', steps: [{ type: 'click' }] })),
    );

    await expect(service.generate({ prompt: 'x' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('throws on a model refusal', async () => {
    const { service, create } = setup();
    create.mockResolvedValue(textResponse('', 'refusal'));

    await expect(service.generate({ prompt: 'x' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('throws on malformed JSON output', async () => {
    const { service, create } = setup();
    create.mockResolvedValue(textResponse('not json'));

    await expect(service.generate({ prompt: 'x' })).rejects.toThrow(
      'malformed JSON',
    );
  });

  it('falls back to a default name and the input startUrl when the model omits them', async () => {
    const { service, create } = setup();
    create.mockResolvedValue(
      textResponse(JSON.stringify({ steps: [{ type: 'goto', url: '/home' }] })),
    );

    const result = await service.generate({ prompt: 'open home', startUrl: '/start' });
    expect(result.name).toBe('Generated test');
    expect(result.startUrl).toBe('/start');
  });
});
