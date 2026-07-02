import {
  findStepDefinition,
  stepRegistry,
  supportedStepTypes,
  validateTestStep,
} from './step-registry';

describe('stepRegistry', () => {
  it('keeps the public step-type order stable (feeds the AI schema enum)', () => {
    expect(supportedStepTypes).toEqual([
      'goto',
      'click',
      'fill',
      'press',
      'select',
      'wait',
      'assertText',
      'assertVisible',
      'assertUrl',
    ]);
  });

  it('registers validation and execution together for every step type', () => {
    for (const type of supportedStepTypes) {
      const definition = stepRegistry[type];
      expect(definition.requiredStrings).toBeDefined();
      expect(typeof definition.run).toBe('function');
    }
  });
});

describe('findStepDefinition', () => {
  it('returns the definition for supported types', () => {
    expect(findStepDefinition('goto')).toBe(stepRegistry.goto);
  });

  it('returns null for unsupported types', () => {
    expect(findStepDefinition('teleport')).toBeNull();
  });

  it('does not match inherited object keys', () => {
    expect(findStepDefinition('constructor')).toBeNull();
    expect(findStepDefinition('toString')).toBeNull();
  });
});

describe('validateTestStep', () => {
  it('validates required string fields per step type', () => {
    expect(validateTestStep({ type: 'goto', url: '/home' })).toBe(true);
    expect(validateTestStep({ type: 'goto' })).toBe(false);
    expect(validateTestStep({ type: 'press', selector: '#n', key: 'Enter' })).toBe(true);
    expect(validateTestStep({ type: 'press', selector: '#n' })).toBe(false);
    expect(validateTestStep({ type: 'assertText', selector: '#t', text: 'hi' })).toBe(true);
    expect(validateTestStep({ type: 'assertText', selector: '#t' })).toBe(false);
  });

  it('validates optional non-negative integer fields', () => {
    expect(validateTestStep({ type: 'wait' })).toBe(true);
    expect(validateTestStep({ type: 'wait', timeoutMs: 250 })).toBe(true);
    expect(validateTestStep({ type: 'wait', timeoutMs: -1 })).toBe(false);
    expect(validateTestStep({ type: 'wait', timeoutMs: 1.5 })).toBe(false);
  });

  it('rejects non-objects, unknown types, and inherited keys', () => {
    expect(validateTestStep(null)).toBe(false);
    expect(validateTestStep('goto')).toBe(false);
    expect(validateTestStep({ type: 'teleport' })).toBe(false);
    expect(validateTestStep({ type: 'constructor' })).toBe(false);
  });
});
