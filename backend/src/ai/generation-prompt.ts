import { supportedStepTypes } from '../test-definitions/dto/test-step.dto';

// JSON-schema-constrained output: the model must return exactly this shape.
// Per-type field requirements are enforced afterwards by validateTestStep.
// Shared by every provider adapter so all providers speak the same step
// language; cross-surface consistency is asserted by
// src/test-steps/step-language-sync.spec.ts.
export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    startUrl: { type: 'string' },
    steps: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...supportedStepTypes] },
          url: { type: 'string' },
          selector: { type: 'string' },
          value: { type: 'string' },
          key: { type: 'string' },
          text: { type: 'string' },
          timeoutMs: { type: 'integer' },
        },
        required: ['type'],
        additionalProperties: false,
      },
    },
  },
  required: ['name', 'startUrl', 'steps'],
  additionalProperties: false,
} as const;

export const SYSTEM_PROMPT = `You convert a plain-language QA testing request into a structured browser test for a Playwright-based runner.

Output a JSON object with: a short "name" (a few words), a "startUrl" (a path like "/login" or an absolute URL; use the provided startUrl when given, otherwise "/"), and an ordered "steps" array.

Each step has a "type" and only the fields that type needs:
- goto: { type, url }
- click: { type, selector }
- fill: { type, selector, value }
- press: { type, selector, key }       // key is a keyboard key like "Enter"
- select: { type, selector, value }
- wait: { type, timeoutMs }            // timeoutMs is an optional non-negative integer
- assertText: { type, selector, text } // text is expected substring
- assertVisible: { type, selector }
- assertUrl: { type, url }

Selector guidance — prefer resilient selectors in this order: data-testid, aria-label, role, visible text, then CSS. Avoid brittle deep CSS/XPath. Do not invent steps the request does not imply. Keep the test minimal and focused on what was asked.`;
