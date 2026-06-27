/*
 * QA Automation Recorder — core logic.
 *
 * Pure, DOM-driven helpers that turn user interactions into the same structured
 * test steps the backend runner executes. Shared by the content script and the
 * unit tests (exported via module.exports when running under Node/Jest).
 *
 * Selector resilience order (per plan.md Phase 2):
 *   data-testid -> aria-label -> role+name -> visible text -> CSS (#id or path)
 * Selector strings use Playwright's selector engines so they work directly with
 * page.click / page.fill / page.locator on the runner side.
 */
(function (global) {
  const TESTID_ATTRS = ['data-testid', 'data-test-id', 'data-test', 'data-qa'];
  const MAX_TEXT_LEN = 50;

  /** Escape a value for use inside a double-quoted selector string. */
  function quote(value) {
    return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  /** Escape a value for use as a CSS #id / .class identifier. */
  function cssEscapeIdent(value) {
    if (global.CSS && typeof global.CSS.escape === 'function') {
      return global.CSS.escape(value);
    }
    // Minimal fallback for environments without CSS.escape.
    return String(value).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
  }

  function attr(el, name) {
    const v = el.getAttribute && el.getAttribute(name);
    return v && v.trim() ? v.trim() : null;
  }

  /** Implicit/explicit ARIA role for the common interactive elements. */
  function roleOf(el) {
    const explicit = attr(el, 'role');
    if (explicit) return explicit;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'a' && el.hasAttribute('href')) return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      const type = (attr(el, 'type') || 'text').toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'reset') return 'button';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (['text', 'email', 'password', 'search', 'tel', 'url', 'number'].includes(type)) {
        return 'textbox';
      }
    }
    return null;
  }

  /** Accessible name: aria-label, then trimmed visible text, then button value. */
  function accessibleName(el) {
    const label = attr(el, 'aria-label');
    if (label) return label;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text && text.length <= MAX_TEXT_LEN) return text;
    const value = attr(el, 'value');
    if (value) return value;
    return null;
  }

  /** Short, unique-ish CSS path used only as a last resort. */
  function cssPath(el) {
    const id = attr(el, 'id');
    if (id) return `#${cssEscapeIdent(id)}`;

    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== 'html') {
      const tag = node.tagName.toLowerCase();
      const nodeId = attr(node, 'id');
      if (nodeId) {
        parts.unshift(`#${cssEscapeIdent(nodeId)}`);
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter(
          (c) => c.tagName === node.tagName,
        );
        if (sameTag.length > 1) {
          const index = sameTag.indexOf(node) + 1;
          parts.unshift(`${tag}:nth-of-type(${index})`);
        } else {
          parts.unshift(tag);
        }
      } else {
        parts.unshift(tag);
      }
      node = parent;
    }
    return parts.join(' > ');
  }

  /** Build the most resilient selector available for an element. */
  function buildSelector(el) {
    for (const a of TESTID_ATTRS) {
      const v = attr(el, a);
      if (v) return `[${a}=${quote(v)}]`;
    }

    const label = attr(el, 'aria-label');
    if (label) return `[aria-label=${quote(label)}]`;

    const role = roleOf(el);
    if (role) {
      const name = accessibleName(el);
      if (name) return `role=${role}[name=${quote(name)}]`;
    }

    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const tag = (el.tagName || '').toLowerCase();
    if (text && text.length <= MAX_TEXT_LEN && (tag === 'a' || tag === 'button' || role)) {
      return `text=${quote(text)}`;
    }

    return cssPath(el);
  }

  /** Closest element worth recording a click on (interactive ancestor or self). */
  function interactiveTarget(el) {
    if (!el || !el.closest) return el;
    return (
      el.closest(
        'a,button,[role=button],[role=link],[role=tab],[role=menuitem],input[type=submit],input[type=button],summary,[onclick]',
      ) || el
    );
  }

  /**
   * Map a DOM event to a test step, or return null to ignore it.
   * Supported: click, fill (change on text inputs), select (change on <select>),
   * press (Enter keydown on inputs).
   */
  function stepFromEvent(event) {
    const target = event.target;
    if (!target || target.nodeType !== 1) return null;
    const tag = (target.tagName || '').toLowerCase();
    const type = (attr(target, 'type') || '').toLowerCase();

    if (event.type === 'click') {
      const el = interactiveTarget(target);
      return { type: 'click', selector: buildSelector(el) };
    }

    if (event.type === 'change') {
      if (tag === 'select') {
        return { type: 'select', selector: buildSelector(target), value: target.value ?? '' };
      }
      if (tag === 'textarea' || (tag === 'input' && !['checkbox', 'radio', 'submit', 'button', 'file'].includes(type))) {
        return { type: 'fill', selector: buildSelector(target), value: target.value ?? '' };
      }
      return null;
    }

    if (event.type === 'keydown') {
      if (event.key === 'Enter' && (tag === 'input' || tag === 'textarea')) {
        return { type: 'press', selector: buildSelector(target), key: 'Enter' };
      }
      return null;
    }

    return null;
  }

  const api = {
    buildSelector,
    stepFromEvent,
    roleOf,
    accessibleName,
    interactiveTarget,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.QARecorder = api;
})(typeof window !== 'undefined' ? window : globalThis);
