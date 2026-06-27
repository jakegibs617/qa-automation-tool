# QA Automation Recorder (Chrome extension)

Record clicks, text input, navigation, and `<select>` changes on any page and
export them as QA Automation **test steps** — the same JSON the backend runner
executes. This is the Phase 2 recorder from `plan.md`: it captures **discrete
actions** and converts them to resilient-selector steps (it does not store a
continuous mouse-movement recording).

## Selectors

Each recorded step gets the most resilient selector available, in this order:

1. `data-testid` (also `data-test-id`, `data-test`, `data-qa`)
2. `aria-label`
3. role + accessible name (e.g. `role=button[name="Log in"]`)
4. visible text (e.g. `text="Docs"`)
5. CSS — `#id`, else a short `nth-of-type` path

These strings work directly with Playwright's `page.click` / `page.fill` /
`page.locator`, which the runner uses.

## Recorded step types

`goto` (navigation), `click`, `fill` (text inputs / textarea), `select`
(`<select>`), and `press` (Enter on an input).

## Load it (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and choose this `extension/` directory.
4. Pin the **QA Automation Recorder** action for quick access.

## Use it

1. Navigate to the page where your test should start.
2. Click the extension, then **Start recording** (the first step is a `goto`
   for the current path).
3. Interact with the page normally.
4. Click **Stop recording**, then **Copy steps JSON**.
5. In the QA Automation app, create a test definition and paste the JSON into
   the steps field (review/tweak as needed), then save and run.

## Develop / test

The selector and event→step logic lives in `recorder.js` and is unit tested
with Jest + jsdom:

```bash
cd extension
npm install
npm test
```

`recorder.js` is shared verbatim between the content script and the tests.
