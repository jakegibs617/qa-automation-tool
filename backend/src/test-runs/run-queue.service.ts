import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  buildRedisConnection,
  RUN_JOB_NAME,
  RUN_QUEUE_NAME,
  RunJobData,
} from './run-queue';

/**
 * Thin wrapper around the BullMQ run queue. The run endpoint enqueues a job
 * here and returns immediately; the {@link RunWorkerService} drains it.
 */
@Injectable()
export class RunQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(RunQueueService.name);
  private readonly queue: Queue<RunJobData>;

  constructor() {
    this.queue = new Queue<RunJobData>(RUN_QUEUE_NAME, {
      connection: buildRedisConnection(),
    });
  }

  async enqueue(runId: string): Promise<void> {
    await this.queue.add(
      RUN_JOB_NAME,
      { runId },
      {
        jobId: runId,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
    this.logger.log(`Enqueued run ${runId}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
