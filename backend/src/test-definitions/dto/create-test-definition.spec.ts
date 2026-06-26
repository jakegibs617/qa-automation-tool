import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateTestDefinitionDto } from './create-test-definition.dto';
import { supportedStepTypes, validateTestStep } from './test-step.dto';

const errorsFor = (payload: Record<string, unknown>) => {
  const dto = plainToInstance(CreateTestDefinitionDto, payload);
  return validateSync(dto, { whitelist: false });
};

const propertiesWithErrors = (payload: Record<string, unknown>) =>
  errorsFor(payload).map((error) => error.property);

const validPayload = () => ({
  name: 'Login flow',
  projectId: '11111111-2222-4333-8444-555555555555',
  startUrl: '/login',
  steps: [{ type: 'goto', url: '/login' }],
});

describe('validateTestStep', () => {
  it('accepts each supported step type with its required fields', () => {
    const validByType: Record<string, Record<string, unknown>> = {
      goto: { type: 'goto', url: '/' },
      click: { type: 'click', selector: '#go' },
      fill: { type: 'fill', selector: '#name', value: 'Ada' },
      press: { type: 'press', selector: '#name', key: 'Enter' },
      select: { type: 'select', selector: '#opt', value: 'one' },
      wait: { type: 'wait', timeoutMs: 500 },
      assertText: { type: 'assertText', selector: '#t', text: 'hi' },
      assertVisible: { type: 'assertVisible', selector: '#t' },
      assertUrl: { type: 'assertUrl', url: '/done' },
    };

    for (const type of supportedStepTypes) {
      expect(validateTestStep(validByType[type])).toBe(true);
    }
  });

  it('treats wait as valid without a timeout but rejects a negative one', () => {
    expect(validateTestStep({ type: 'wait' })).toBe(true);
    expect(validateTestStep({ type: 'wait', timeoutMs: -1 })).toBe(false);
    expect(validateTestStep({ type: 'wait', timeoutMs: 1.5 })).toBe(false);
  });

  it('rejects unknown types, non-objects, and missing required fields', () => {
    expect(validateTestStep({ type: 'teleport', url: '/' })).toBe(false);
    expect(validateTestStep(null)).toBe(false);
    expect(validateTestStep('goto')).toBe(false);
    expect(validateTestStep([])).toBe(false);
    expect(validateTestStep({ type: 'goto' })).toBe(false);
    expect(validateTestStep({ type: 'fill', selector: '#a' })).toBe(false);
    expect(validateTestStep({ type: 'click', selector: '   ' })).toBe(false);
  });
});

describe('CreateTestDefinitionDto validation', () => {
  it('accepts a well-formed payload', () => {
    expect(errorsFor(validPayload())).toHaveLength(0);
  });

  it('accepts an absolute startUrl', () => {
    expect(
      errorsFor({ ...validPayload(), startUrl: 'https://example.com/login' }),
    ).toHaveLength(0);
  });

  it('rejects a non-UUID projectId', () => {
    expect(propertiesWithErrors({ ...validPayload(), projectId: 'nope' })).toContain(
      'projectId',
    );
  });

  it('rejects an empty name', () => {
    expect(propertiesWithErrors({ ...validPayload(), name: '' })).toContain('name');
  });

  it('rejects a startUrl that is neither absolute nor root-relative', () => {
    expect(
      propertiesWithErrors({ ...validPayload(), startUrl: 'login' }),
    ).toContain('startUrl');
  });

  it('rejects an empty steps array', () => {
    expect(propertiesWithErrors({ ...validPayload(), steps: [] })).toContain('steps');
  });

  it('rejects steps containing an invalid step', () => {
    expect(
      propertiesWithErrors({
        ...validPayload(),
        steps: [{ type: 'goto', url: '/' }, { type: 'click' }],
      }),
    ).toContain('steps');
  });
});
