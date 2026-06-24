import { strict as assert } from 'assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const storageDir = mkdtempSync(join(tmpdir(), 'qa-artifacts-'));
process.env.ARTIFACTS_DIR = storageDir;

async function main() {
  // Import after ARTIFACTS_DIR is set so the storage service picks up the temp dir.
  const { ArtifactStorageService } = await import(
    '../src/artifacts/artifact-storage.service'
  );
  const {
    buildRunReport,
    buildFailurePlaceholderSvg,
    buildTracePlaceholder,
  } = await import('../src/test-runs/run-report');

  const storage = new ArtifactStorageService();

  // Storage roundtrip.
  const key = 'runs/test-run/report.json';
  const size = await storage.write(key, '{"ok":true}');
  assert.equal(size, Buffer.byteLength('{"ok":true}'));
  assert.equal(await storage.exists(key), true);
  assert.equal((await storage.read(key)).toString(), '{"ok":true}');
  assert.equal(await storage.exists('runs/missing/report.json'), false);

  // Path traversal is rejected.
  assert.throws(() => storage.resolvePath('../../escape.txt'));

  // Passing report build.
  const passing = buildRunReport({
    runId: 'run-1',
    projectId: 'project-1',
    testDefinitionId: 'def-1',
    testDefinitionName: 'Homepage smoke test',
    status: 'passed',
    startedAt: 1_000,
    finishedAt: 1_250,
    failureStep: null,
    errorMessage: null,
    steps: [
      { stepNumber: 1, type: 'goto', status: 'passed', log: '1. goto /', durationMs: 5 },
    ],
    logs: ['Starting test run', '1. goto /', 'Test run completed successfully'],
  });
  assert.equal(passing.durationMs, 250);
  assert.equal(passing.status, 'passed');
  assert.equal(passing.failureStep, null);
  assert.equal(passing.startedAt, new Date(1_000).toISOString());

  // Failing report build + placeholder artifacts.
  const failing = buildRunReport({
    runId: 'run-2',
    projectId: 'project-1',
    testDefinitionId: 'def-1',
    testDefinitionName: 'Login flow',
    status: 'failed',
    startedAt: 0,
    finishedAt: 100,
    failureStep: 2,
    errorMessage: 'Unsupported step type at step 2',
    steps: [
      { stepNumber: 1, type: 'goto', status: 'passed', log: '1. goto /', durationMs: 5 },
      {
        stepNumber: 2,
        type: 'click',
        status: 'failed',
        log: '2. click failed: boom',
        durationMs: 2,
      },
    ],
    logs: ['Starting test run', 'Test run failed at step 2'],
  });
  assert.equal(failing.status, 'failed');
  assert.equal(failing.failureStep, 2);

  const svg = buildFailurePlaceholderSvg(failing);
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('Step 2: click'));
  // Error text must be XML-escaped, not raw.
  assert.ok(!svg.includes('<script'));

  const trace = JSON.parse(buildTracePlaceholder(failing));
  assert.equal(trace.runId, 'run-2');
  assert.equal(trace.capturedSteps.length, 2);

  console.log('Checkpoint 4 smoke checks passed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    rmSync(storageDir, { recursive: true, force: true });
  });
