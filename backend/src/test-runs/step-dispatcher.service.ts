import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';
import { TestStepDto } from '../test-definitions/dto/test-step.dto';
import {
  findStepDefinition,
  StepContext,
  StepDispatchResult,
} from '../test-steps/step-registry';

export { resolveUrl } from '../test-steps/step-registry';
export type { StepContext, StepDispatchResult };

/**
 * Executes a single test step against a live Playwright page by delegating to
 * the step registry's handler for the step type. Actions throw on failure (a
 * Playwright timeout, a missing element, or a failed assertion); the runner
 * turns a thrown error into a failed step + captured artifacts.
 */
@Injectable()
export class StepDispatcherService {
  async dispatch(
    page: Page,
    step: TestStepDto,
    stepNumber: number,
    ctx: StepContext,
  ): Promise<StepDispatchResult> {
    const definition = findStepDefinition(step.type);
    if (!definition) {
      throw new Error(`Unsupported step type at step ${stepNumber}`);
    }

    return definition.run(page, step, stepNumber, ctx);
  }
}
