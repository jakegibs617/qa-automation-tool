import { spawn } from 'node:child_process';

const port = process.env.PORT ?? '3100';
const url = `http://127.0.0.1:${port}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(path) {
  const response = await fetch(`${url}${path}`);
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with ${response.status}`);
  }
  return response.text();
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.text();
      }
    } catch {
      await wait(500);
    }
  }

  throw new Error(`Frontend did not respond at ${url}`);
}

const server = spawn('npm', ['run', 'start', '--', '-p', port], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  },
});

try {
  const html = await waitForServer();
  const requiredText = ['QA Automation', 'Current project', 'Tutorial'];
  const missing = requiredText.filter((text) => !html.includes(text));

  if (missing.length > 0) {
    throw new Error(`App shell missing expected text: ${missing.join(', ')}`);
  }

  const runDetailHtml = await fetchText('/runs/smoke-check');
  const runDetailRequired = ['Run detail', 'Back to dashboard'];
  const runDetailMissing = runDetailRequired.filter((text) => !runDetailHtml.includes(text));

  if (runDetailMissing.length > 0) {
    throw new Error(`Run detail view missing expected text: ${runDetailMissing.join(', ')}`);
  }

  console.log(`Smoke check passed at ${url}`);
} finally {
  server.kill('SIGTERM');
}
