import { spawn } from 'node:child_process';

const port = process.env.PORT ?? '3100';
const url = `http://127.0.0.1:${port}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const requiredText = ['QA Automation', 'Current project'];
  const missing = requiredText.filter((text) => !html.includes(text));

  if (missing.length > 0) {
    throw new Error(`App shell missing expected text: ${missing.join(', ')}`);
  }

  console.log(`Smoke check passed at ${url}`);
} finally {
  server.kill('SIGTERM');
}
