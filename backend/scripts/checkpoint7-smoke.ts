import { strict as assert } from 'assert';
import { Queue, Worker } from 'bullmq';

import {
  buildRedisConnection,
  RUN_JOB_NAME,
  RUN_QUEUE_NAME,
  RunJobData,
} from '../src/test-runs/run-queue';
import { RunQueueService } from '../src/test-runs/run-queue.service';

/**
 * Checkpoint 7 smoke: proves the async run path's BullMQ wiring round-trips
 * through real Redis. It does NOT touch Postgres or Playwright — it exercises
 * the shared queue contract (queue name, job name, payload) that the real
 * RunQueueService/RunWorkerService rely on.
 *
 * Requires Redis on REDIS_HOST/REDIS_PORT (docker compose up -d redis).
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function waitFor<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), ms),
  );
  return Promise.race([promise, timeout]);
}

async function main() {
  const connection = buildRedisConnection();
  const processed: Array<{ runId: string; jobName: string }> = [];
  const first = deferred<void>();
  const second = deferred<void>();
  const smokeRunIds = ['smoke-run-1', 'smoke-run-2'];
  const cleanupQueue = new Queue<RunJobData>(RUN_QUEUE_NAME, { connection });

  const worker = new Worker<RunJobData>(
    RUN_QUEUE_NAME,
    async (job) => {
      processed.push({ runId: job.data.runId, jobName: job.name });
      if (job.data.runId === 'smoke-run-1') first.resolve();
      if (job.data.runId === 'smoke-run-2') second.resolve();
    },
    { connection },
  );

  const queueService = new RunQueueService();

  try {
    await removeSmokeJobs(cleanupQueue, smokeRunIds);
    await worker.waitUntilReady();

    // Enqueue via the real service the API uses.
    await queueService.enqueue('smoke-run-1');
    await waitFor(first.promise, 10_000, 'smoke-run-1 to be processed');

    await queueService.enqueue('smoke-run-2');
    await waitFor(second.promise, 10_000, 'smoke-run-2 to be processed');

    assert.equal(processed.length, 2, 'both jobs should be processed');
    assert.deepEqual(
      processed.map((p) => p.runId).sort(),
      ['smoke-run-1', 'smoke-run-2'],
      'both run ids should round-trip through Redis',
    );
    assert.ok(
      processed.every((p) => p.jobName === RUN_JOB_NAME),
      `jobs should use the "${RUN_JOB_NAME}" job name`,
    );

    console.log('Checkpoint 7 smoke checks passed');
  } finally {
    await removeSmokeJobs(cleanupQueue, smokeRunIds);
    await cleanupQueue.close();
    await worker.close();
    await queueService.onModuleDestroy();
  }
}

async function removeSmokeJobs(queue: Queue<RunJobData>, runIds: string[]) {
  await Promise.all(
    runIds.map(async (runId) => {
      const job = await queue.getJob(runId);
      if (job) {
        await job.remove();
      }
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
