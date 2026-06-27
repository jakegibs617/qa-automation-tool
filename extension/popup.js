/* Popup: drives recording state and renders the recorded steps as JSON. */
const toggleBtn = document.getElementById('toggle');
const clearBtn = document.getElementById('clear');
const copyBtn = document.getElementById('copy');
const output = document.getElementById('output');
const countEl = document.getElementById('count');
const dot = document.getElementById('dot');

function send(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (state) => resolve(state));
  });
}

function render(state) {
  const recording = Boolean(state && state.recording);
  const steps = (state && state.steps) || [];

  toggleBtn.textContent = recording ? 'Stop recording' : 'Start recording';
  toggleBtn.classList.toggle('primary', !recording);
  toggleBtn.classList.toggle('stop', recording);
  dot.classList.toggle('live', recording);

  countEl.textContent = String(steps.length);
  output.value = steps.length ? JSON.stringify(steps, null, 2) : '';
  copyBtn.disabled = steps.length === 0;
}

async function activeTabPath() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs && tabs[0] && tabs[0].url;
      if (!url) return resolve(null);
      try {
        const u = new URL(url);
        resolve(u.pathname + u.search);
      } catch {
        resolve(null);
      }
    });
  });
}

toggleBtn.addEventListener('click', async () => {
  const state = await send({ action: 'getState' });
  if (state && state.recording) {
    render(await send({ action: 'stop' }));
  } else {
    const path = await activeTabPath();
    render(await send({ action: 'start', path }));
  }
});

clearBtn.addEventListener('click', async () => {
  render(await send({ action: 'clear' }));
});

copyBtn.addEventListener('click', async () => {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = 'Copy steps JSON'), 1200);
  } catch {
    output.select();
    document.execCommand('copy');
  }
});

// Keep the popup live while open.
send({ action: 'getState' }).then(render);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['qa-recorder-state']) {
    render(changes['qa-recorder-state'].newValue);
  }
});
