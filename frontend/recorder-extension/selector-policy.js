// Shared DOM-safe selector policy used by both the classic (non-module)
// content script and the ES-module runtime (background/popup/recorder-core,
// and Node-based smoke tests).
//
// MV3 declarative content scripts cannot be loaded as ES modules, so this
// file intentionally avoids `import`/`export` syntax and instead assigns a
// single namespace onto `globalThis`. Classic scripts (manifest
// `content_scripts`) read it directly; ES modules import this file for its
// side effect and re-export what they need from the same namespace. This
// keeps exactly one implementation of selector priority without introducing
// a bundler.
(function attachRecorderSelectorPolicy(root) {
  const TEST_ID_ATTRS = ['data-testid', 'data-test-id', 'data-test', 'data-qa'];

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

  function testId(element) {
    for (const name of TEST_ID_ATTRS) {
      const value = attr(element, name);
      if (value) return { attr: name, value };
    }
    return null;
  }

  function targetFromElement(element) {
    const text = visibleText(element);
    const role = explicitOrInferredRole(element);
    const testIdMatch = testId(element);
    return {
      testId: testIdMatch ? testIdMatch.value : null,
      testIdAttr: testIdMatch ? testIdMatch.attr : null,
      ariaLabel: attr(element, 'aria-label'),
      role,
      text,
      css: cssSelector(element),
    };
  }

  root.RecorderSelectorPolicy = {
    TEST_ID_ATTRS,
    attr,
    visibleText,
    explicitOrInferredRole,
    cssSelector,
    cssEscape,
    testId,
    targetFromElement,
  };
})(globalThis);
