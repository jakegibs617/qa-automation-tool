import type { Page } from 'playwright';

/**
 * Single registration point for a test-step type: its validation rules and
 * its Playwright execution behavior live in one entry. Adding a step type
 * means adding one entry here, then updating the places that intentionally
 * stay separate (kept in sync by hand — see the checklist below):
 *
 * - AI generation prompt/schema: `backend/src/ai/ai-test-generation.service.ts`
 * - Frontend step typing: `frontend/lib/api.ts` (`TestStep`)
 * - Recorder conversion: `frontend/recorder-extension/recorder-core.js`
 */

export type StepContext = {
  baseUrl: string;
};

export type StepDispatchResult = {
  log: string;
};

export type TestStepDto = {
  type: SupportedStepType;
  url?: string;
  selector?: string;
  value?: string;
  key?: string;
  timeoutMs?: number;
  text?: string;
};

type StepStringField = 'url' | 'selector' | 'value' | 'key' | 'text';

type StepDefinition = {
  /** String fields that must be present and non-empty for the step to validate. */
  requiredStrings: ReadonlyArray<StepStringField>;
  /** Integer fields that may be omitted but must be >= 0 when present. */
  optionalNonNegativeIntegers?: ReadonlyArray<'timeoutMs'>;
  /** Executes the step against a live page; throws on failure. */
  run: (
    page: Page,
    step: TestStepDto,
    stepNumber: number,
    ctx: StepContext,
  ) => Promise<StepDispatchResult>;
};

/**
 * Resolve a (possibly relative) target URL against the project base URL.
 * Absolute URLs are returned unchanged; relative paths are joined to the base.
 */
export const resolveUrl = (baseUrl: string, target?: string): string => {
  if (!target) {
    return baseUrl;
  }
  try {
    return new URL(target, baseUrl || undefined).toString();
  } catch {
    return target;
  }
};

// Key order is the public step-type order (it feeds the AI schema enum and
// docs), so keep new entries appended deliberately.
export const stepRegistry = {
  goto: {
    requiredStrings: ['url'],
    run: async (page, step, stepNumber, ctx) => {
      const url = resolveUrl(ctx.baseUrl, step.url);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      return { log: `${stepNumber}. goto ${url}` };
    },
  },
  click: {
    requiredStrings: ['selector'],
    run: async (page, step, stepNumber) => {
      await page.click(step.selector!);
      return { log: `${stepNumber}. click ${step.selector}` };
    },
  },
  fill: {
    requiredStrings: ['selector', 'value'],
    run: async (page, step, stepNumber) => {
      await page.fill(step.selector!, step.value ?? '');
      return { log: `${stepNumber}. fill ${step.selector}` };
    },
  },
  press: {
    requiredStrings: ['selector', 'key'],
    run: async (page, step, stepNumber) => {
      await page.press(step.selector!, step.key!);
      return { log: `${stepNumber}. press ${step.key} on ${step.selector}` };
    },
  },
  select: {
    requiredStrings: ['selector', 'value'],
    run: async (page, step, stepNumber) => {
      await page.selectOption(step.selector!, step.value!);
      return { log: `${stepNumber}. select ${step.value} on ${step.selector}` };
    },
  },
  wait: {
    requiredStrings: [],
    optionalNonNegativeIntegers: ['timeoutMs'],
    run: async (page, step, stepNumber) => {
      await page.waitForTimeout(step.timeoutMs ?? 0);
      return { log: `${stepNumber}. wait ${step.timeoutMs ?? 0}ms` };
    },
  },
  assertText: {
    requiredStrings: ['selector', 'text'],
    run: async (page, step, stepNumber) => {
      const locator = page.locator(step.selector!);
      await locator.waitFor({ state: 'visible' });
      const text = (await locator.textContent()) ?? '';
      if (!text.includes(step.text!)) {
        throw new Error(
          `Expected text "${step.text}" in ${step.selector}, but found "${text.trim()}"`,
        );
      }
      return { log: `${stepNumber}. assert text on ${step.selector}` };
    },
  },
  assertVisible: {
    requiredStrings: ['selector'],
    run: async (page, step, stepNumber) => {
      await page.locator(step.selector!).waitFor({ state: 'visible' });
      return { log: `${stepNumber}. assert visible ${step.selector}` };
    },
  },
  assertUrl: {
    requiredStrings: ['url'],
    run: async (page, step, stepNumber, ctx) => {
      const expected = resolveUrl(ctx.baseUrl, step.url);
      const actual = page.url();
      if (actual !== expected) {
        throw new Error(`Expected URL ${expected}, but page is at ${actual}`);
      }
      return { log: `${stepNumber}. assert url ${expected}` };
    },
  },
} satisfies Record<string, StepDefinition>;

export type SupportedStepType = keyof typeof stepRegistry;

export const supportedStepTypes = Object.keys(
  stepRegistry,
) as ReadonlyArray<SupportedStepType>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasString = (step: Record<string, unknown>, key: string) =>
  typeof step[key] === 'string' && String(step[key]).trim().length > 0;

const hasOptionalNonNegativeInteger = (
  step: Record<string, unknown>,
  key: string,
) =>
  step[key] === undefined ||
  (typeof step[key] === 'number' && Number.isInteger(step[key]) && step[key] >= 0);

/**
 * Guarded lookup: a plain `stepRegistry[type]` on an untrusted string would
 * also match inherited keys like "constructor".
 */
export const findStepDefinition = (type: string): StepDefinition | null =>
  Object.prototype.hasOwnProperty.call(stepRegistry, type)
    ? stepRegistry[type as SupportedStepType]
    : null;

export const validateTestStep = (value: unknown): value is TestStepDto => {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  const definition = findStepDefinition(value.type);
  if (!definition) {
    return false;
  }

  return (
    definition.requiredStrings.every((field) => hasString(value, field)) &&
    (definition.optionalNonNegativeIntegers ?? []).every((field) =>
      hasOptionalNonNegativeInteger(value, field),
    )
  );
};
