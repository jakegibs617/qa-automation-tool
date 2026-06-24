import { strict as assert } from 'assert';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';

import { StepDispatcherService } from '../src/test-runs/step-dispatcher.service';
import { PlaywrightRunnerService } from '../src/test-runs/playwright-runner.service';

const PAGE_HTML = `<!doctype html>
<html>
  <head><title>QA Smoke</title></head>
  <body>
    <h1 id="title">Welcome to QA</h1>
    <button id="go">Go</button>
  </body>
</html>`;

function startServer(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PAGE_HTML);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function main() {
  const { server, baseUrl } = await startServer();
  const runner = new PlaywrightRunnerService(new StepDispatcherService());

  try {
    // Passing run: navigate + assertions that hold against the page.
    const passing = await runner.run({
      baseUrl,
      startUrl: '/',
      steps: [
        { type: 'assertVisible', selector: '#title' },
        { type: 'assertText', selector: '#title', text: 'Welcome' },
        { type: 'click', selector: '#go' },
      ],
    });
    assert.equal(passing.status, 'passed', 'passing run should pass');
    assert.equal(passing.failureStep, null);
    assert.equal(passing.errorMessage, null);
    assert.equal(passing.steps.length, 3);
    assert.ok(passing.steps.every((step) => step.status === 'passed'));
    // No failure artifacts on a passing run.
    assert.equal(passing.screenshot, null);
    assert.equal(passing.trace, null);

    // Failing run: an assertion that does not hold produces real artifacts.
    const failing = await runner.run({
      baseUrl,
      startUrl: '/',
      steps: [
        { type: 'assertVisible', selector: '#title' },
        { type: 'assertText', selector: '#title', text: 'Goodbye' },
      ],
    });
    assert.equal(failing.status, 'failed', 'failing run should fail');
    assert.equal(failing.failureStep, 2);
    assert.ok(failing.errorMessage?.includes('Goodbye'));
    assert.equal(failing.steps[0].status, 'passed');
    assert.equal(failing.steps[1].status, 'failed');
    // Real PNG screenshot + Playwright trace captured on failure.
    assert.ok(Buffer.isBuffer(failing.screenshot), 'screenshot should be a Buffer');
    assert.ok((failing.screenshot as Buffer).length > 0, 'screenshot should be non-empty');
    // PNG magic bytes.
    assert.equal((failing.screenshot as Buffer)[0], 0x89);
    assert.equal((failing.screenshot as Buffer).toString('ascii', 1, 4), 'PNG');
    assert.ok(Buffer.isBuffer(failing.trace), 'trace should be a Buffer');
    assert.ok((failing.trace as Buffer).length > 0, 'trace should be non-empty');
    // Playwright traces are zip archives (PK magic bytes).
    assert.equal((failing.trace as Buffer).toString('ascii', 0, 2), 'PK');

    // Navigation failure: unreachable start URL is reported as failureStep 0.
    const unreachable = await runner.run({
      baseUrl: 'http://127.0.0.1:1',
      startUrl: '/',
      steps: [{ type: 'assertVisible', selector: '#title' }],
    });
    assert.equal(unreachable.status, 'failed', 'unreachable start URL should fail');
    assert.equal(unreachable.failureStep, 0);
    assert.equal(unreachable.steps.length, 0);

    console.log('Checkpoint 5 smoke checks passed');
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
