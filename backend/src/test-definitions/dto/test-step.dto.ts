import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { validateTestStep } from '../../test-steps/step-registry';

// The step registry is the source of truth for step types, their required
// fields, and their execution behavior.
export {
  supportedStepTypes,
  validateTestStep,
} from '../../test-steps/step-registry';
export type {
  SupportedStepType,
  TestStepDto,
} from '../../test-steps/step-registry';

export function IsTestSteps(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isTestSteps',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return Array.isArray(value) && value.length > 0 && value.every(validateTestStep);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a non-empty array of supported test steps`;
        },
      },
    });
  };
}
