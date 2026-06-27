import { recordingToTestDefinition } from './recorder-core.js';

const status = document.querySelector('#status');
const output = document.querySelector('#output');
const start = document.querySelector('#start');
const stop = document.querySelector('#stop');
const clear = document.querySelector('#clear');
const copy = document.querySelector('#copy');

start.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const startUrl = tab?.url ?? '/';
  await chrome.runtime.sendMessage({
    type: 'start',
    tabId: tab?.id,
    windowId: tab?.windowId,
    origin: safeOrigin(startUrl),
    name: tab?.title ? `${tab.title} recorded flow` : 'Recorded test',
    startUrl,
  });
  await refresh();
});

stop.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'stop' });
  await refresh();
});

clear.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'clear' });
  await refresh();
});

copy.addEventListener('click', async () => {
  await navigator.clipboard.writeText(output.value);
  copy.textContent = 'Copied';
  setTimeout(() => {
    copy.textContent = 'Copy JSON';
  }, 900);
});

async function refresh() {
  const state = await readState();
  const definition = recordingToTestDefinition(state);
  status.textContent = state.recording ? `${state.actions.length} actions` : 'Idle';
  output.value = JSON.stringify(definition, null, 2);
}

async function readState() {
  return chrome.runtime.sendMessage({ type: 'get' });
}

function safeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

void refresh();
