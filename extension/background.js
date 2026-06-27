/*
 * Service worker: owns the recording state and the recorded steps. All
 * mutations funnel through a single promise chain so rapid events from the
 * content script can't race on the read-modify-write of chrome.storage.
 */
const KEY = 'qa-recorder-state';

const EMPTY = { recording: false, steps: [], startPath: null };

let chain = Promise.resolve();

function getState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(KEY, (data) => resolve({ ...EMPTY, ...(data[KEY] || {}) }));
  });
}

function setState(state) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEY]: state }, () => resolve(state));
  });
}

/** Serialize a read-modify-write so concurrent events don't clobber steps. */
function mutate(fn) {
  chain = chain.then(async () => {
    const next = await fn(await getState());
    return setState(next);
  });
  return chain;
}

function lastStep(steps) {
  return steps.length ? steps[steps.length - 1] : null;
}

const handlers = {
  async start(_msg, path) {
    return mutate(() => {
      const steps = [];
      if (path) steps.push({ type: 'goto', url: path });
      return { recording: true, steps, startPath: path || null };
    });
  },
  async stop() {
    return mutate((state) => ({ ...state, recording: false }));
  },
  async clear() {
    return mutate((state) => ({ ...EMPTY, startPath: state.startPath }));
  },
  async addStep(msg) {
    return mutate((state) => {
      if (!state.recording || !msg.step) return state;
      return { ...state, steps: [...state.steps, msg.step] };
    });
  },
  async addGoto(msg) {
    return mutate((state) => {
      if (!state.recording || !msg.path) return state;
      const prev = lastStep(state.steps);
      // Skip if we already navigated here (initial goto or a repeat).
      if (prev && prev.type === 'goto' && prev.url === msg.path) return state;
      return { ...state, steps: [...state.steps, { type: 'goto', url: msg.path }] };
    });
  },
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.action === 'getState') {
    getState().then(sendResponse);
    return true;
  }
  const handler = handlers[message && message.action];
  if (!handler) return false;
  handler(message, message.path)
    .then(getState)
    .then(sendResponse);
  return true; // async response
});
