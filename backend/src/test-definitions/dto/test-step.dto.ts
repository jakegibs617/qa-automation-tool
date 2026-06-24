import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export const supportedStepTypes = [
  'goto',
  'click',
  'fill',
  'press',
  'select',
  'wait',
  'assertText',
  'assertVisible',
  'assertUrl',
] as const;

export type SupportedStepType = (typeof supportedStepTypes)[number];

export type TestStepDto = {
  type: SupportedStepType;
  url?: string;
  selector?: string;
  value?: string;
  key?: string;
  timeoutMs?: number;
  text?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasString = (step: Record<string, unknown>, key: string) =>
  typeof step[key] === 'string' && String(step[key]).trim().length > 0;

const hasOptionalPositiveNumber = (step: Record<string, unknown>, key: string) =>
  step[key] === undefined ||
  (typeof step[key] === 'number' && Number.isInteger(step[key]) && step[key] >= 0);

export const validateTestStep = (value: unknown): value is TestStepDto => {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  if (!supportedStepTypes.includes(value.type as SupportedStepType)) {
    return false;
  }

  switch (value.type) {
    case 'goto':
    case 'assertUrl':
      return hasString(value, 'url');
    case 'click':
    case 'assertVisible':
      return hasString(value, 'selector');
    case 'fill':
    case 'select':
      return hasString(value, 'selector') && hasString(value, 'value');
    case 'press':
      return hasString(value, 'selector') && hasString(value, 'key');
    case 'wait':
      return hasOptionalPositiveNumber(value, 'timeoutMs');
    case 'assertText':
      return hasString(value, 'selector') && hasString(value, 'text');
    default:
      return false;
  }
};

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
