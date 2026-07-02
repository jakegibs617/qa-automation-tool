import { strict as assert } from 'node:assert';

import {
  actionToStep,
  isActionInRecordingScope,
  recordingToTestDefinition,
  selectorFromTarget,
  targetFromElement,
} from '../recorder-extension/recorder-core.js';

function fakeElement(attrs) {
  return {
    tagName: 'DIV',
    id: '',
    className: '',
    parentElement: null,
    nodeType: 1,
    textContent: '',
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
  };
}

assert.equal(
  targetFromElement(fakeElement({ 'data-qa': 'row-1' })).testId,
  'row-1',
);
assert.equal(
  targetFromElement(fakeElement({ 'data-testid': 'primary', 'data-qa': 'row-1' })).testId,
  'primary',
);

// Round-trip through selectorFromTarget: the selector must reference whichever
// attribute actually matched, not always assume data-testid.
assert.equal(
  selectorFromTarget(targetFromElement(fakeElement({ 'data-qa': 'row-1' }))),
  '[data-qa="row-1"]',
);
assert.equal(
  selectorFromTarget(targetFromElement(fakeElement({ 'data-test-id': 'submit' }))),
  '[data-test-id="submit"]',
);

assert.equal(
  selectorFromTarget({
    testId: 'login-button',
    ariaLabel: 'Sign in',
    role: 'button',
    text: 'Login',
    css: 'button.primary',
  }),
  '[data-testid="login-button"]',
);

assert.equal(
  selectorFromTarget({
    ariaLabel: 'Sign in',
    role: 'button',
    text: 'Login',
    css: 'button.primary',
  }),
  '[aria-label="Sign in"]',
);

assert.equal(
  selectorFromTarget({
    role: 'button',
    text: 'Login',
    css: 'button.primary',
  }),
  'role=button[name="Login"]',
);

assert.deepEqual(
  actionToStep({
    type: 'fill',
    value: 'ada@example.com',
    target: { testId: 'email', css: '#email' },
  }),
  { type: 'fill', selector: '[data-testid="email"]', value: 'ada@example.com' },
);

assert.equal(
  actionToStep({
    type: 'fill',
    value: 'super-secret',
    sensitive: true,
    target: { testId: 'password', css: '#password' },
  }),
  null,
);

assert.deepEqual(
  recordingToTestDefinition({
    name: 'Login flow',
    startUrl: 'https://example.test/login',
    actions: [
      { type: 'click', target: { text: 'Login', css: 'button' } },
      {
        type: 'select',
        value: 'admin',
        target: { ariaLabel: 'Role', css: 'select' },
      },
      {
        type: 'press',
        key: 'Enter',
        target: { role: 'textbox', text: 'Search', css: 'input.search' },
      },
    ],
  }),
  {
    name: 'Login flow',
    startUrl: '/login',
    steps: [
      { type: 'goto', url: '/login' },
      { type: 'click', selector: 'text=Login' },
      { type: 'select', selector: '[aria-label="Role"]', value: 'admin' },
      { type: 'press', selector: 'role=textbox[name="Search"]', key: 'Enter' },
    ],
  },
);

const scope = {
  recording: true,
  tabId: 7,
  windowId: 2,
  origin: 'https://example.test',
};

assert.equal(
  isActionInRecordingScope(scope, {
    tabId: 7,
    windowId: 2,
    action: { type: 'click', url: 'https://example.test/page' },
  }),
  true,
);
assert.equal(
  isActionInRecordingScope(scope, {
    tabId: 8,
    windowId: 2,
    action: { type: 'click', url: 'https://example.test/page' },
  }),
  false,
);
assert.equal(
  isActionInRecordingScope(scope, {
    tabId: 7,
    windowId: 2,
    action: { type: 'click', url: 'https://other.test/page' },
  }),
  false,
);

console.log('Recorder smoke checks passed');
