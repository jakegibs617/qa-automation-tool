import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';
import { TestStepDto } from '../test-definitions/dto/test-step.dto';

export type StepDispatchResult = {
  log: string;
};

export type StepContext = {
  baseUrl: string;
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

/**
 * Executes a single test step against a live Playwright page. Actions throw on
 * failure (a Playwright timeout, a missing element, or a failed assertion); the
 * runner turns a thrown error into a failed step + captured artifacts.
 */
@Injectable()
export class StepDispatcherService {
  async dispatch(
    page: Page,
    step: TestStepDto,
    stepNumber: number,
    ctx: StepContext,
  ): Promise<StepDispatchResult> {
    switch (step.type) {
      case 'goto': {
        const url = resolveUrl(ctx.baseUrl, step.url);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return { log: `${stepNumber}. goto ${url}` };
      }
      case 'click':
        await page.click(step.selector!);
        return { log: `${stepNumber}. click ${step.selector}` };
      case 'fill':
        await page.fill(step.selector!, step.value ?? '');
        return { log: `${stepNumber}. fill ${step.selector}` };
      case 'press':
        await page.press(step.selector!, step.key!);
        return { log: `${stepNumber}. press ${step.key} on ${step.selector}` };
      case 'select':
        await page.selectOption(step.selector!, step.value!);
        return { log: `${stepNumber}. select ${step.value} on ${step.selector}` };
      case 'wait':
        await page.waitForTimeout(step.timeoutMs ?? 0);
        return { log: `${stepNumber}. wait ${step.timeoutMs ?? 0}ms` };
      case 'assertText': {
        const locator = page.locator(step.selector!);
        await locator.waitFor({ state: 'visible' });
        const text = (await locator.textContent()) ?? '';
        if (!text.includes(step.text!)) {
          throw new Error(
            `Expected text "${step.text}" in ${step.selector}, but found "${text.trim()}"`,
          );
        }
        return { log: `${stepNumber}. assert text on ${step.selector}` };
      }
      case 'assertVisible':
        await page.locator(step.selector!).waitFor({ state: 'visible' });
        return { log: `${stepNumber}. assert visible ${step.selector}` };
      case 'assertUrl': {
        const expected = resolveUrl(ctx.baseUrl, step.url);
        const actual = page.url();
        if (actual !== expected) {
          throw new Error(`Expected URL ${expected}, but page is at ${actual}`);
        }
        return { log: `${stepNumber}. assert url ${expected}` };
      }
      default:
        throw new Error(`Unsupported step type at step ${stepNumber}`);
    }
  }
}
