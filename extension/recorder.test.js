const { buildSelector, stepFromEvent } = require('./recorder.js');

function el(html) {
  document.body.innerHTML = html;
  return document.body.firstElementChild;
}

describe('buildSelector', () => {
  it('prefers a test id over everything else', () => {
    const node = el('<button data-testid="submit" aria-label="Go" id="x">Go</button>');
    expect(buildSelector(node)).toBe('[data-testid="submit"]');
  });

  it('supports alternate test-id attributes', () => {
    expect(buildSelector(el('<div data-qa="row-1">r</div>'))).toBe('[data-qa="row-1"]');
  });

  it('falls back to aria-label', () => {
    expect(buildSelector(el('<button aria-label="Close dialog">x</button>'))).toBe(
      '[aria-label="Close dialog"]',
    );
  });

  it('uses role and accessible name for a button', () => {
    expect(buildSelector(el('<button>Log in</button>'))).toBe('role=button[name="Log in"]');
  });

  it('uses role=link for an anchor with href', () => {
    expect(buildSelector(el('<a href="/profile">Profile</a>'))).toBe(
      'role=link[name="Profile"]',
    );
  });

  it('uses a visible-text selector when there is no role/name', () => {
    // An <a> without href has no link role, so it falls through to text=.
    expect(buildSelector(el('<a>Docs</a>'))).toBe('text="Docs"');
  });

  it('falls back to a #id CSS selector', () => {
    expect(buildSelector(el('<div id="main-content">…</div>'))).toBe('#main-content');
  });

  it('builds an nth-of-type CSS path as a last resort', () => {
    document.body.innerHTML = '<ul><li>one</li><li>two</li></ul>';
    const second = document.querySelectorAll('li')[1];
    const selector = buildSelector(second);
    expect(selector).toContain('li:nth-of-type(2)');
    expect(selector).toContain('ul');
  });

  it('escapes quotes in selector values', () => {
    expect(buildSelector(el('<button aria-label=\'Say "hi"\'>x</button>'))).toBe(
      '[aria-label="Say \\"hi\\""]',
    );
  });
});

describe('stepFromEvent', () => {
  it('records a click and resolves to the interactive ancestor', () => {
    el('<button data-testid="save"><span>Save</span></button>');
    const span = document.querySelector('span');
    expect(stepFromEvent({ type: 'click', target: span })).toEqual({
      type: 'click',
      selector: '[data-testid="save"]',
    });
  });

  it('records a fill from a text input change with its value', () => {
    const input = el('<input data-testid="email" type="email" />');
    input.value = 'a@b.com';
    expect(stepFromEvent({ type: 'change', target: input })).toEqual({
      type: 'fill',
      selector: '[data-testid="email"]',
      value: 'a@b.com',
    });
  });

  it('records a select from a <select> change', () => {
    const select = el(
      '<select data-testid="plan"><option value="free">Free</option><option value="pro">Pro</option></select>',
    );
    select.value = 'pro';
    expect(stepFromEvent({ type: 'change', target: select })).toEqual({
      type: 'select',
      selector: '[data-testid="plan"]',
      value: 'pro',
    });
  });

  it('records Enter as a press on an input', () => {
    const input = el('<input data-testid="q" type="search" />');
    expect(stepFromEvent({ type: 'keydown', target: input, key: 'Enter' })).toEqual({
      type: 'press',
      selector: '[data-testid="q"]',
      key: 'Enter',
    });
  });

  it('ignores non-Enter keydowns', () => {
    const input = el('<input type="text" />');
    expect(stepFromEvent({ type: 'keydown', target: input, key: 'a' })).toBeNull();
  });

  it('ignores changes on checkboxes', () => {
    const box = el('<input type="checkbox" />');
    expect(stepFromEvent({ type: 'change', target: box })).toBeNull();
  });
});
