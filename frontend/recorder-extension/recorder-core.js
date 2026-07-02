export const recorderActionTypes = ['goto', 'click', 'fill', 'press', 'select'];

export function selectorFromTarget(target) {
  if (target.testId) {
    return `[data-testid="${cssEscape(target.testId)}"]`;
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

const TEST_ID_ATTRS = ['data-testid', 'data-test-id', 'data-test', 'data-qa'];

function testId(element) {
  for (const name of TEST_ID_ATTRS) {
    const value = attr(element, name);
    if (value) return value;
  }
  return null;
}

export function targetFromElement(element) {
  const text = visibleText(element);
  const role = explicitOrInferredRole(element);
  return {
    testId: testId(element),
    ariaLabel: attr(element, 'aria-label'),
    role,
    text,
    css: cssSelector(element),
  };
}

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

function attr(element, name) {
  const value = element.getAttribute?.(name);
  return nonEmpty(value) ? value.trim() : null;
}

function visibleText(element) {
  const value =
    element.innerText ||
    element.textContent ||
    attr(element, 'title') ||
    '';
  return nonEmpty(value) ? value.replace(/\s+/g, ' ').trim().slice(0, 80) : null;
}

function explicitOrInferredRole(element) {
  const explicit = attr(element, 'role');
  if (explicit) {
    return explicit;
  }

  const tag = element.tagName?.toLowerCase();
  if (tag === 'button') return 'button';
  if (tag === 'a' && attr(element, 'href')) return 'link';
  if (tag === 'select') return 'combobox';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'input') {
    const type = (attr(element, 'type') || 'text').toLowerCase();
    if (['button', 'submit', 'reset'].includes(type)) return 'button';
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    return 'textbox';
  }
  return null;
}

function cssSelector(element) {
  if (element.id) {
    return `#${cssEscape(element.id)}`;
  }

  const parts = [];
  let current = element;
  while (current && current.nodeType === 1 && parts.length < 4) {
    const tag = current.tagName.toLowerCase();
    let part = tag;
    const className = typeof current.className === 'string' ? current.className : '';
    const stableClass = className
      .split(/\s+/)
      .find((name) => name && !/^(css-|sc-|jsx-|_)/.test(name));
    if (stableClass) {
      part += `.${cssEscape(stableClass)}`;
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === current.tagName,
      );
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
    }

    parts.unshift(part);
    current = parent;
  }

  return parts.join(' > ');
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) {
    return globalThis.CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, '\\$&');
}
