import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import {
  buildRedisConnection,
  RUN_QUEUE_NAME,
  RunJobData,
} from './run-queue';
import { TestRunsService } from './test-runs.service';

/**
 * Drains the BullMQ run queue, executing one run per job by delegating to
 * {@link TestRunsService.executeRun}. The worker owns the Playwright lifecycle
 * off the request path so the API can return `queued` immediately.
 */
@Injectable()
export class RunWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RunWorkerService.name);
  private worker: Worker<RunJobData> | null = null;

  constructor(private readonly testRunsService: TestRunsService) {}

  async onModuleInit(): Promise<void> {
    const concurrency = Number(process.env.RUN_WORKER_CONCURRENCY ?? 1);

    const reconciled = await this.testRunsService.reconcilePendingRuns();
    if (reconciled.runningFailed > 0 || reconciled.queuedFailed > 0) {
      this.logger.warn(
        `Reconciled pending runs on worker startup: ${reconciled.runningFailed} running, ${reconciled.queuedFailed} queued marked failed`,
      );
    }

    this.worker = new Worker<RunJobData>(
      RUN_QUEUE_NAME,
      async (job) => {
        this.logger.log(`Executing run ${job.data.runId}`);
        await this.testRunsService.executeRun(job.data.runId);
      },
      { connection: buildRedisConnection(), concurrency },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Run job ${job?.data.runId ?? job?.id} failed: ${error.message}`,
      );
      if (job?.data.runId) {
        void this.testRunsService.markRunInterrupted(
          job.data.runId,
          `Run worker job failed: ${error.message}`,
        );
      }
    });

    this.worker.on('stalled', (jobId) => {
      this.logger.error(`Run job ${jobId} stalled`);
      void this.testRunsService.markRunInterrupted(
        String(jobId),
        'Run worker job stalled',
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
