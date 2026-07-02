const { targetFromElement, attr } = globalThis.RecorderSelectorPolicy;

const ignoredSelector = '[data-qa-recorder-ignore="true"]';
const interactiveSelector = 'a,button,input,textarea,select,[role],summary,[onclick]';

document.addEventListener('click', (event) => {
  const origin = event.target;
  if (!origin?.closest) return;
  // Fall back to the clicked element itself so clicks on custom
  // (non-semantic) controls still get recorded, e.g. a plain <div> with a
  // click handler and no role attribute.
  const target = origin.closest(interactiveSelector) || origin;
  if (target.closest(ignoredSelector)) {
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

