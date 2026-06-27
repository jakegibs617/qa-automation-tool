import { isActionInRecordingScope } from './recorder-core.js';

const STORAGE_KEY = 'qaRecorderState';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleMessage(message, sender).then(sendResponse);
  return true;
});

async function handleMessage(message, sender) {
  if (message?.type === 'start') {
    const state = {
      recording: true,
      tabId: message.tabId,
      windowId: message.windowId,
      origin: message.origin,
      name: message.name,
      startUrl: message.startUrl,
      actions: [{ type: 'goto', url: message.startUrl, timestamp: Date.now() }],
    };
    await writeState(state);
    return state;
  }

  if (message?.type === 'stop') {
    const state = await readState();
    await writeState({ ...state, recording: false });
    return readState();
  }

  if (message?.type === 'clear') {
    const state = { recording: false, actions: [] };
    await writeState(state);
    return state;
  }

  if (message?.type === 'get') {
    return readState();
  }

  if (message?.type === 'record') {
    const state = await readState();
    if (!shouldAcceptAction(state, sender, message.action)) {
      return state;
    }

    const next = { ...state, actions: [...state.actions, message.action] };
    await writeState(next);
    return next;
  }

  return readState();
}

function shouldAcceptAction(state, sender, action) {
  return isActionInRecordingScope(state, {
    action,
    tabId: sender.tab?.id,
    windowId: sender.tab?.windowId,
  });
}

async function readState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? { recording: false, actions: [] };
}

async function writeState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}
