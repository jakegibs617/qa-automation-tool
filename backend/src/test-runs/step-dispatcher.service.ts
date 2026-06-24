import { Injectable } from '@nestjs/common';
import { TestStepDto } from '../test-definitions/dto/test-step.dto';

export type StepDispatchResult = {
  log: string;
};

@Injectable()
export class StepDispatcherService {
  async dispatch(step: TestStepDto, stepNumber: number): Promise<StepDispatchResult> {
    switch (step.type) {
      case 'goto':
        return { log: `${stepNumber}. goto ${step.url}` };
      case 'click':
        return { log: `${stepNumber}. click ${step.selector}` };
      case 'fill':
        return { log: `${stepNumber}. fill ${step.selector}` };
      case 'press':
        return { log: `${stepNumber}. press ${step.key} on ${step.selector}` };
      case 'select':
        return { log: `${stepNumber}. select ${step.value} on ${step.selector}` };
      case 'wait':
        return { log: `${stepNumber}. wait ${step.timeoutMs ?? 0}ms` };
      case 'assertText':
        return { log: `${stepNumber}. assert text on ${step.selector}` };
      case 'assertVisible':
        return { log: `${stepNumber}. assert visible ${step.selector}` };
      case 'assertUrl':
        return { log: `${stepNumber}. assert url ${step.url}` };
      default:
        throw new Error(`Unsupported step type at step ${stepNumber}`);
    }
  }
}
