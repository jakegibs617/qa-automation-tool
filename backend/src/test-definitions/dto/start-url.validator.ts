import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const isAbsoluteOrRelativeUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  if (value.startsWith('/')) {
    return true;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export function IsStartUrl(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isStartUrl',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isAbsoluteOrRelativeUrl,
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be an absolute URL or a path starting with /`;
        },
      },
    });
  };
}
