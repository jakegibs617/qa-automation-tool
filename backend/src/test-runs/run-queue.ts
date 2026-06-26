import type { ConnectionOptions } from 'bullmq';

/** BullMQ queue that carries one job per test run to execute. */
export const RUN_QUEUE_NAME = 'test-runs';

/** Job name for the single "execute this run" job kind on the queue. */
export const RUN_JOB_NAME = 'execute';

/** Payload enqueued for each run; the worker loads the rest from the DB. */
export type RunJobData = {
  runId: string;
};

/**
 * Builds the Redis connection options shared by the queue and the worker.
 * Passing plain options (rather than a shared ioredis instance) lets BullMQ
 * create correctly-configured blocking/non-blocking clients itself.
 */
export function buildRedisConnection(): ConnectionOptions {
  return {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
  };
}
