import './selector-policy.js';

const { targetFromElement, cssEscape } = globalThis.RecorderSelectorPolicy;

export const recorderActionTypes = ['goto', 'click', 'fill', 'press', 'select'];

export function selectorFromTarget(target) {
  if (target.testId) {
    return `[${target.testIdAttr || 'data-testid'}="${cssEscape(target.testId)}"]`;
  }
  if (target.ariaLabel) {
    return `[aria-label="${cssEscape(target.ariaLabel)}"]`;
  }
  if (target.role && target.text) {
    return `role=${target.role}[name="${selectorText(target.text)}"]`;
  }
  if (target.text) {
    return `text=${selectorText(target.text)}`;
  }
  return target.css;
}

export function actionToStep(action) {
  if (action.sensitive) {
    return null;
  }

  if (action.type === 'goto') {
    return nonEmpty(action.url) ? { type: 'goto', url: action.url } : null;
  }

  const selector = action.target ? selectorFromTarget(action.target) : null;
  if (!selector) {
    return null;
  }

  if (action.type === 'click') {
    return { type: 'click', selector };
  }
  if (action.type === 'fill') {
    return nonEmpty(action.value) ? { type: 'fill', selector, value: action.value } : null;
  }
  if (action.type === 'press') {
    return nonEmpty(action.key) ? { type: 'press', selector, key: action.key } : null;
  }
  if (action.type === 'select') {
    return nonEmpty(action.value)
      ? { type: 'select', selector, value: action.value }
      : null;
  }

  return null;
}

export function recordingToTestDefinition(recording) {
  const actions = Array.isArray(recording?.actions) ? recording.actions : [];
  const steps = actions.map(actionToStep).filter(Boolean);
  const startUrl =
    firstGotoUrl(steps) || normalizePath(recording?.startUrl) || '/';

  return {
    name: nonEmpty(recording?.name) ? recording.name.trim() : 'Recorded test',
    startUrl,
    steps: ensureLeadingGoto(steps, startUrl),
  };
}

export function isActionInRecordingScope(state, candidate) {
  if (!state?.recording || !candidate?.action) {
    return false;
  }
  if (candidate.tabId !== state.tabId || candidate.windowId !== state.windowId) {
    return false;
  }

  try {
    return new URL(candidate.action.url).origin === state.origin;
  } catch {
    return false;
  }
}

export { targetFromElement };

function ensureLeadingGoto(steps, startUrl) {
  if (steps[0]?.type === 'goto') {
    return steps;
  }
  return [{ type: 'goto', url: startUrl }, ...steps];
}

function firstGotoUrl(steps) {
  return steps.find((step) => step.type === 'goto')?.url ?? null;
}

function normalizePath(value) {
  if (!nonEmpty(value)) {
    return null;
  }

  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}${url.hash}` || '/';
  } catch {
    return value.trim();
  }
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function selectorText(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 80).replace(/"/g, '\\"');
}
