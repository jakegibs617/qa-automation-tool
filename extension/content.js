/*
 * Content script: while recording is active, turn the user's interactions into
 * steps (via recorder.js) and forward them to the background worker. Loaded
 * after recorder.js, so window.QARecorder is available.
 */
(function () {
  const { stepFromEvent } = window.QARecorder;

  let recording = false;

  function currentPath() {
    return location.pathname + location.search;
  }

  function send(message) {
    try {
      chrome.runtime.sendMessage(message);
    } catch {
      // The extension context can be invalidated on reload; ignore.
    }
  }

  function handle(event) {
    if (!recording) return;
    const step = stepFromEvent(event);
    if (step) send({ action: 'addStep', step });
  }

  // Capture phase so we still see the event even if the page calls
  // stopPropagation on it.
  document.addEventListener('click', handle, true);
  document.addEventListener('change', handle, true);
  document.addEventListener('keydown', handle, true);

  // Sync initial state, and record a goto if we navigated mid-recording.
  send({ action: 'getState' });
  chrome.runtime.sendMessage({ action: 'getState' }, (state) => {
    if (chrome.runtime.lastError || !state) return;
    recording = Boolean(state.recording);
    if (recording) {
      send({ action: 'addGoto', path: currentPath() });
    }
  });

  // Keep `recording` in sync when the popup toggles it.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes['qa-recorder-state']) return;
    const next = changes['qa-recorder-state'].newValue;
    recording = Boolean(next && next.recording);
  });
})();
