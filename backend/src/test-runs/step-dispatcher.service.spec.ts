import type { Page } from 'playwright';
import { resolveUrl, StepDispatcherService } from './step-dispatcher.service';

type LocatorMock = {
  waitFor: jest.Mock;
  textContent: jest.Mock;
};

const createLocator = (text = ''): LocatorMock => ({
  waitFor: jest.fn().mockResolvedValue(undefined),
  textContent: jest.fn().mockResolvedValue(text),
});

const createPage = (overrides: Partial<Record<string, unknown>> = {}) => {
  const locator = createLocator(
    typeof overrides.__text === 'string' ? (overrides.__text as string) : '',
  );
  const page = {
    goto: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    fill: jest.fn().mockResolvedValue(undefined),
    press: jest.fn().mockResolvedValue(undefined),
    selectOption: jest.fn().mockResolvedValue(undefined),
    waitForTimeout: jest.fn().mockResolvedValue(undefined),
    locator: jest.fn().mockReturnValue(locator),
    url: jest.fn().mockReturnValue((overrides.__url as string) ?? 'http://base/current'),
  };
  return { page: page as unknown as Page, raw: page, locator };
};

describe('resolveUrl', () => {
  it('returns the base URL when no target is provided', () => {
    expect(resolveUrl('http://base', undefined)).toBe('http://base');
  });

  it('joins a relative path against the base URL', () => {
    expect(resolveUrl('http://base.test', '/login')).toBe('http://base.test/login');
  });

  it('leaves an absolute target unchanged', () => {
    expect(resolveUrl('http://base.test', 'https://other.test/x')).toBe(
      'https://other.test/x',
    );
  });

  it('returns the raw target when neither base nor target is a valid URL', () => {
    expect(resolveUrl('', 'not a url')).toBe('not a url');
  });
});

describe('StepDispatcherService', () => {
  let service: StepDispatcherService;

  beforeEach(() => {
    service = new StepDispatcherService();
  });

  const ctx = { baseUrl: 'http://base.test' };

  it('navigates to a resolved URL for goto', async () => {
    const { page, raw } = createPage();
    const result = await service.dispatch(page, { type: 'goto', url: '/home' }, 1, ctx);

    expect(raw.goto).toHaveBeenCalledWith('http://base.test/home', {
      waitUntil: 'domcontentloaded',
    });
    expect(result.log).toBe('1. goto http://base.test/home');
  });

  it('clicks the given selector', async () => {
    const { page, raw } = createPage();
    await service.dispatch(page, { type: 'click', selector: '#go' }, 2, ctx);
    expect(raw.click).toHaveBeenCalledWith('#go');
  });

  it('fills with an empty string when value is omitted', async () => {
    const { page, raw } = createPage();
    await service.dispatch(page, { type: 'fill', selector: '#n' }, 3, ctx);
    expect(raw.fill).toHaveBeenCalledWith('#n', '');
  });

  it('presses a key on a selector', async () => {
    const { page, raw } = createPage();
    await service.dispatch(
      page,
      { type: 'press', selector: '#n', key: 'Enter' },
      4,
      ctx,
    );
    expect(raw.press).toHaveBeenCalledWith('#n', 'Enter');
  });

  it('selects an option', async () => {
    const { page, raw } = createPage();
    await service.dispatch(
      page,
      { type: 'select', selector: '#s', value: 'one' },
      5,
      ctx,
    );
    expect(raw.selectOption).toHaveBeenCalledWith('#s', 'one');
  });

  it('waits for the given timeout, defaulting to 0', async () => {
    const { page, raw } = createPage();
    await service.dispatch(page, { type: 'wait', timeoutMs: 250 }, 6, ctx);
    expect(raw.waitForTimeout).toHaveBeenCalledWith(250);

    await service.dispatch(page, { type: 'wait' }, 7, ctx);
    expect(raw.waitForTimeout).toHaveBeenLastCalledWith(0);
  });

  it('passes assertText when the locator contains the expected text', async () => {
    const { page } = createPage({ __text: 'Welcome to QA' });
    const result = await service.dispatch(
      page,
      { type: 'assertText', selector: '#t', text: 'Welcome' },
      8,
      ctx,
    );
    expect(result.log).toBe('8. assert text on #t');
  });

  it('throws a descriptive error when assertText does not match', async () => {
    const { page } = createPage({ __text: 'Welcome to QA' });
    await expect(
      service.dispatch(
        page,
        { type: 'assertText', selector: '#t', text: 'Goodbye' },
        9,
        ctx,
      ),
    ).rejects.toThrow('Expected text "Goodbye" in #t');
  });

  it('waits for visibility on assertVisible', async () => {
    const { page, locator } = createPage();
    await service.dispatch(page, { type: 'assertVisible', selector: '#t' }, 10, ctx);
    expect(locator.waitFor).toHaveBeenCalledWith({ state: 'visible' });
  });

  it('passes assertUrl when the current URL matches the resolved expectation', async () => {
    const { page } = createPage({ __url: 'http://base.test/done' });
    const result = await service.dispatch(
      page,
      { type: 'assertUrl', url: '/done' },
      11,
      ctx,
    );
    expect(result.log).toBe('11. assert url http://base.test/done');
  });

  it('throws when assertUrl does not match the current URL', async () => {
    const { page } = createPage({ __url: 'http://base.test/elsewhere' });
    await expect(
      service.dispatch(page, { type: 'assertUrl', url: '/done' }, 12, ctx),
    ).rejects.toThrow('Expected URL http://base.test/done');
  });

  it('throws for an unsupported step type', async () => {
    const { page } = createPage();
    await expect(
      service.dispatch(page, { type: 'teleport' } as never, 13, ctx),
    ).rejects.toThrow('Unsupported step type at step 13');
  });
});
