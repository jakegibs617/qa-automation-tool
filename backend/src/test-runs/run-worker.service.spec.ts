import { RunWorkerService } from './run-worker.service';

type WorkerHandler = (...args: unknown[]) => void;

type MockWorkerInstance = {
  on: jest.Mock;
  close: jest.Mock;
  handlers: Record<string, WorkerHandler>;
};

const workerInstances: MockWorkerInstance[] = [];

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => {
    const instance: MockWorkerInstance = {
      handlers: {} as Record<string, WorkerHandler>,
      on: jest.fn((event: string, handler: WorkerHandler): MockWorkerInstance => {
        instance.handlers[event] = handler;
        return instance;
      }),
      close: jest.fn(async () => undefined),
    };
    workerInstances.push(instance);
    return instance;
  }),
}));

describe('RunWorkerService', () => {
  beforeEach(() => {
    workerInstances.length = 0;
    jest.clearAllMocks();
  });

  const setup = () => {
    const testRunsService = {
      executeRun: jest.fn(async () => undefined),
      reconcilePendingRuns: jest.fn(async () => ({
        runningFailed: 0,
        queuedFailed: 0,
      })),
      markRunInterrupted: jest.fn(async () => undefined),
    };

    const service = new RunWorkerService(testRunsService as never);
    return { service, testRunsService };
  };

  it('reconciles pending runs before starting the worker', async () => {
    const { service, testRunsService } = setup();

    await service.onModuleInit();

    expect(testRunsService.reconcilePendingRuns).toHaveBeenCalledTimes(1);
    expect(workerInstances).toHaveLength(1);
  });

  it('delegates queued jobs to TestRunsService.executeRun', async () => {
    const { service, testRunsService } = setup();

    await service.onModuleInit();
    const processor = (jest.requireMock('bullmq').Worker as jest.Mock).mock.calls[0][1];
    await processor({ data: { runId: 'run-1' } });

    expect(testRunsService.executeRun).toHaveBeenCalledWith('run-1');
  });

  it('marks runs interrupted when a job fails', async () => {
    const { service, testRunsService } = setup();

    await service.onModuleInit();
    workerInstances[0].handlers.failed(
      { data: { runId: 'run-1' }, id: 'run-1' },
      new Error('redis lost lock'),
    );

    expect(testRunsService.markRunInterrupted).toHaveBeenCalledWith(
      'run-1',
      'Run worker job failed: redis lost lock',
    );
  });

  it('marks runs interrupted when a job stalls', async () => {
    const { service, testRunsService } = setup();

    await service.onModuleInit();
    workerInstances[0].handlers.stalled('run-1');

    expect(testRunsService.markRunInterrupted).toHaveBeenCalledWith(
      'run-1',
      'Run worker job stalled',
    );
  });

  it('closes the worker on shutdown', async () => {
    const { service } = setup();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(workerInstances[0].close).toHaveBeenCalledTimes(1);
  });
});
