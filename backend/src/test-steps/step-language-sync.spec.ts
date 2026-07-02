import * as fs from 'node:fs';
import * as path from 'node:path';
import { OUTPUT_SCHEMA, SYSTEM_PROMPT } from '../ai/generation-prompt';
import { stepRegistry, supportedStepTypes } from './step-registry';

/**
 * TestStep is the product's shared language: the same step types flow through
 * AI generation, the editor, the recorder, validation, and execution. The
 * registry is the source of truth; the surfaces below are intentionally kept
 * as plain per-surface definitions (no shared package), so this spec is what
 * catches drift between them.
 */

const repoRoot = path.resolve(__dirname, '../../..');
const readRepoFile = (relative: string) =>
  fs.readFileSync(path.join(repoRoot, relative), 'utf8');

type FieldRules = {
  requiredStrings: ReadonlyArray<string>;
  optionalNonNegativeIntegers?: ReadonlyArray<string>;
};

describe('test-step language sync', () => {
  it('AI output schema enumerates exactly the registry step types', () => {
    expect(OUTPUT_SCHEMA.properties.steps.items.properties.type.enum).toEqual([
      ...supportedStepTypes,
    ]);
  });

  it('AI output schema has a property for every field a step type can use', () => {
    const schemaFields = Object.keys(OUTPUT_SCHEMA.properties.steps.items.properties);
    for (const definition of Object.values(stepRegistry) as FieldRules[]) {
      const fields = [
        ...definition.requiredStrings,
        ...(definition.optionalNonNegativeIntegers ?? []),
      ];
      for (const field of fields) {
        expect(schemaFields).toContain(field);
      }
    }
  });

  it('the AI system prompt documents every registry step type', () => {
    for (const type of supportedStepTypes) {
      expect(SYSTEM_PROMPT).toContain(`- ${type}: {`);
    }
  });

  it('frontend TestStep union includes every registry step type', () => {
    const api = readRepoFile('frontend/lib/api.ts');
    const testStepType = api.match(/export type TestStep = \{[\s\S]*?\n\};/)?.[0];
    expect(testStepType).toBeDefined();
    for (const type of supportedStepTypes) {
      expect(testStepType).toContain(`'${type}'`);
    }
  });

  it('recorder action types are a subset of registry step types', () => {
    const core = readRepoFile('frontend/recorder-extension/recorder-core.js');
    const actionTypesLiteral = core.match(/recorderActionTypes = \[([^\]]*)\]/)?.[1];
    expect(actionTypesLiteral).toBeDefined();
    const recorderTypes = actionTypesLiteral!
      .split(',')
      .map((entry) => entry.trim().replace(/['"]/g, ''))
      .filter(Boolean);
    expect(recorderTypes.length).toBeGreaterThan(0);
    for (const type of recorderTypes) {
      expect(supportedStepTypes).toContain(type as (typeof supportedStepTypes)[number]);
    }
  });
});
