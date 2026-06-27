const ignoredSelector = '[data-qa-recorder-ignore="true"]';

document.addEventListener('click', (event) => {
  const target = event.target?.closest?.('a,button,input,textarea,select,[role]');
  if (!target || target.closest(ignoredSelector)) {
    return;
  }

  record({
    type: 'click',
    target: targetFromElement(target),
    url: location.href,
    timestamp: Date.now(),
  });
}, true);

document.addEventListener('change', (event) => {
  const target = event.target;
  if (!isFormControl(target) || target.closest(ignoredSelector)) {
    return;
  }
  if (isSensitiveControl(target)) {
    return;
  }

  record({
    type: target.tagName.toLowerCase() === 'select' ? 'select' : 'fill',
    target: targetFromElement(target),
    value: target.value,
    url: location.href,
    timestamp: Date.now(),
  });
}, true);

document.addEventListener('keydown', (event) => {
  const target = event.target;
  if (!isFormControl(target) || target.closest(ignoredSelector)) {
    return;
  }
  if (isSensitiveControl(target)) {
    return;
  }
  if (!['Enter', 'Escape', 'Tab'].includes(event.key)) {
    return;
  }

  record({
    type: 'press',
    target: targetFromElement(target),
    key: event.key,
    url: location.href,
    timestamp: Date.now(),
  });
}, true);

async function record(action) {
  await chrome.runtime.sendMessage({ type: 'record', action });
}

function isFormControl(value) {
  return value instanceof HTMLInputElement ||
    value instanceof HTMLTextAreaElement ||
    value instanceof HTMLSelectElement;
}

function isSensitiveControl(element) {
  const fields = [
    element.type,
    element.name,
    element.id,
    element.autocomplete,
    element.placeholder,
    attr(element, 'aria-label'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    element.type === 'password' ||
    /\b(password|passcode|secret|token|api[-_ ]?key|credential|authorization|auth|ssn|card|cvv|cvc|otp|one[-_ ]?time)\b/.test(fields)
  );
}

function targetFromElement(element) {
  const text = visibleText(element);
  const role = explicitOrInferredRole(element);
  return {
    testId: attr(element, 'data-testid'),
    ariaLabel: attr(element, 'aria-label'),
    role,
    text,
    css: cssSelector(element),
  };
}

function attr(element, name) {
  const value = element.getAttribute?.(name);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function visibleText(element) {
  const value =
    element.innerText ||
    element.textContent ||
    attr(element, 'title') ||
    '';
  return typeof value === 'string' && value.trim()
    ? value.replace(/\s+/g, ' ').trim().slice(0, 80)
    : null;
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
