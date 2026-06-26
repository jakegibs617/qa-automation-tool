import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AiTestGenerationService } from './ai-test-generation.service';

const textResponse = (text: string, stopReason = 'end_turn') => ({
  stop_reason: stopReason,
  content: [{ type: 'text', text }],
});

const setup = (configured = true) => {
  const create = jest.fn();
  const client = configured ? ({ messages: { create } } as never) : null;
  const service = new AiTestGenerationService(client);
  return { service, create };
};

describe('AiTestGenerationService', () => {
  describe('when not configured', () => {
    it('reports not configured', () => {
      const { service } = setup(false);
      expect(service.isConfigured()).toBe(false);
    });

    it('throws ServiceUnavailable on generate', async () => {
      const { service } = setup(false);
      await expect(service.generate({ prompt: 'log in' })).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('generate', () => {
    it('sends a schema-constrained request including the prompt and hints', async () => {
      const { service, create } = setup();
      create.mockResolvedValue(
        textResponse(
          JSON.stringify({
            name: 'Login flow',
            startUrl: '/login',
            steps: [{ type: 'goto', url: '/login' }],
          }),
        ),
      );

      await service.generate({
        prompt: 'log in and reach the dashboard',
        startUrl: '/login',
        baseUrl: 'http://app.test',
      });

      const params = create.mock.calls[0][0];
      expect(params.model).toBe('claude-opus-4-8');
      expect(params.output_config.format.type).toBe('json_schema');
      expect(params.messages[0].content).toContain('log in and reach the dashboard');
      expect(params.messages[0].content).toContain('/login');
      expect(params.messages[0].content).toContain('http://app.test');
    });

    it('returns the validated name, startUrl, and steps', async () => {
      const { service, create } = setup();
      create.mockResolvedValue(
        textResponse(
          JSON.stringify({
            name: 'Login flow',
            startUrl: '/login',
            steps: [
              { type: 'goto', url: '/login' },
              { type: 'fill', selector: '#email', value: 'a@b.com' },
              { type: 'assertText', selector: '#title', text: 'Welcome' },
            ],
          }),
        ),
      );

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

    it('drops steps that fail per-type validation but keeps the valid ones', async () => {
      const { service, create } = setup();
      create.mockResolvedValue(
        textResponse(
          JSON.stringify({
            name: 'Mixed',
            startUrl: '/',
            steps: [
              { type: 'goto', url: '/' },
              { type: 'click' }, // missing selector — invalid
              { type: 'assertVisible', selector: '#ok' },
            ],
          }),
        ),
      );

      const result = await service.generate({ prompt: 'do things' });
      expect(result.steps.map((s) => s.type)).toEqual(['goto', 'assertVisible']);
    });

    it('throws when no steps are valid', async () => {
      const { service, create } = setup();
      create.mockResolvedValue(
        textResponse(
          JSON.stringify({ name: 'x', startUrl: '/', steps: [{ type: 'click' }] }),
        ),
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
      await expect(service.generate({ prompt: 'x' })).rejects.toBeInstanceOf(
        UnprocessableEntityException,
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
});
