import { NotFoundException } from '@nestjs/common';
import { TestRunsService } from './test-runs.service';
import { RunnerOutcome } from './playwright-runner.service';

const buildDefinition = () => ({
  id: 'def-1',
  projectId: 'proj-1',
  name: 'Login flow',
  startUrl: '/login',
  steps: [{ type: 'goto', url: '/login' }],
  project: { baseUrl: 'http://base.test' },
});

const buildQueuedRun = () => ({
  id: 'run-1',
  projectId: 'proj-1',
  testDefinitionId: 'def-1',
  status: 'queued' as const,
  logs: ['Run queued for "Login flow"'],
});

const passingOutcome = (): RunnerOutcome => ({
  status: 'passed',
  steps: [
    { stepNumber: 1, type: 'goto', status: 'passed', log: '1. goto', durationMs: 5 },
  ],
  logs: ['Navigated to start URL'],
  failureStep: null,
  errorMessage: null,
  screenshot: null,
  trace: null,
});

const failingOutcome = (overrides: Partial<RunnerOutcome> = {}): RunnerOutcome => ({
  status: 'failed',
  steps: [
    { stepNumber: 1, type: 'goto', status: 'passed', log: '1. goto', durationMs: 5 },
    {
      stepNumber: 2,
      type: 'assertText',
      status: 'failed',
      log: '2. failed',
      durationMs: 7,
    },
  ],
  logs: ['failed at step 2'],
  failureStep: 2,
  errorMessage: 'Expected text "x"',
  screenshot: Buffer.from('\x89PNG fake'),
  trace: Buffer.from('PK fake'),
  ...overrides,
});

type SetupOptions = {
  definition?: ReturnType<typeof buildDefinition> | null;
  runRecord?: ReturnType<typeof buildQueuedRun> | null;
};

const setup = (options: SetupOptions = {}) => {
  const definition =
    'definition' in options ? options.definition : buildDefinition();
  const runRecord =
    'runRecord' in options ? options.runRecord : buildQueuedRun();

  const savedArtifacts: Array<Record<string, unknown>> = [];
  // The service mutates a single run object in place, so capture the status at
  // each save to observe the queued → running → passed/failed transitions.
  const statusHistory: string[] = [];

  const testRunRepository = {
    create: jest.fn((input) => ({ ...input })),
    save: jest.fn(async (run) => {
      if (!run.id) run.id = 'run-1';
      statusHistory.push(run.status);
      return run;
    }),
    // findOne is used both to load the queued run (no relations) and to reload
    // the fully-hydrated run at the end (with relations).
    findOne: jest.fn(async ({ where, relations }) => {
      if (relations) {
        return { id: where.id, __fetched: true };
      }
      return runRecord;
    }),
    find: jest.fn(),
  };

  const testDefinitionRepository = {
    findOne: jest.fn(async () => definition),
  };

  const artifactRepository = {
    create: jest.fn((input) => ({ ...input })),
    save: jest.fn(async (artifact) => {
      savedArtifacts.push(artifact);
      return artifact;
    }),
  };

  const runner = { run: jest.fn() };
  const storage = { write: jest.fn(async () => 1234) };
  const runQueue = { enqueue: jest.fn(async () => undefined) };

  const service = new TestRunsService(
    testRunRepository as never,
    testDefinitionRepository as never,
    artifactRepository as never,
    runner as never,
    storage as never,
    runQueue as never,
  );

  return {
    service,
    testRunRepository,
    testDefinitionRepository,
    artifactRepository,
    runner,
    storage,
    runQueue,
    savedArtifacts,
    statusHistory,
  };
};

const storageKeys = (savedArtifacts: Array<Record<string, unknown>>) =>
  savedArtifacts.map((artifact) => artifact.storageKey as string);

describe('TestRunsService.enqueueRun', () => {
  it('throws NotFoundException when the definition does not exist', async () => {
    const { service, runQueue } = setup({ definition: null });
    await expect(service.enqueueRun('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(runQueue.enqueue).not.toHaveBeenCalled();
  });

  it('persists a queued run and enqueues it, without running the browser', async () => {
    const { service, testRunRepository, runner, runQueue } = setup();

    await service.enqueueRun('def-1');

    const created = testRunRepository.create.mock.calls[0][0];
    expect(created.status).toBe('queued');
    expect(created.projectId).toBe('proj-1');
    expect(created.testDefinitionId).toBe('def-1');

    expect(runQueue.enqueue).toHaveBeenCalledWith('run-1');
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('returns the freshly reloaded queued run via findOne', async () => {
    const { service } = setup();
    const result = await service.enqueueRun('def-1');
    expect(result).toMatchObject({ id: 'run-1', __fetched: true });
  });

  it('marks the run failed when enqueue throws so it is not stuck queued', async () => {
    const { service, runQueue, statusHistory } = setup();
    runQueue.enqueue.mockRejectedValueOnce(new Error('redis down'));

    await service.enqueueRun('def-1');

    expect(statusHistory).toEqual(['queued', 'failed']);
    const failedSave = statusHistory.lastIndexOf('failed');
    expect(failedSave).toBeGreaterThanOrEqual(0);
  });
});

describe('TestRunsService.executeRun', () => {
  it('throws NotFoundException when the run is missing', async () => {
    const { service, runner } = setup({ runRecord: null });
    await expect(service.executeRun('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('marks the run failed when its definition no longer exists', async () => {
    const { service, testRunRepository, runner } = setup({ definition: null });

    await service.executeRun('run-1');

    const savedRun = testRunRepository.save.mock.calls.at(-1)![0];
    expect(savedRun.status).toBe('failed');
    expect(savedRun.errorMessage).toBe('Test definition not found');
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('transitions to running and delegates to the runner with project context', async () => {
    const definition = buildDefinition();
    const { service, runner, statusHistory } = setup({ definition });
    runner.run.mockResolvedValue(passingOutcome());

    await service.executeRun('run-1');

    // First save transitions queued → running, the last records the result.
    expect(statusHistory[0]).toBe('running');
    expect(statusHistory.at(-1)).toBe('passed');
    expect(runner.run).toHaveBeenCalledWith({
      baseUrl: 'http://base.test',
      startUrl: '/login',
      steps: definition.steps,
    });
  });

  it('persists a passing run with only the report.json log artifact', async () => {
    const { service, testRunRepository, runner, savedArtifacts } = setup();
    runner.run.mockResolvedValue(passingOutcome());

    await service.executeRun('run-1');

    const savedRun = testRunRepository.save.mock.calls.at(-1)![0];
    expect(savedRun.status).toBe('passed');
    expect(savedRun.failureStep).toBeNull();
    expect(savedRun.logs).toContain('Test run completed successfully');

    expect(storageKeys(savedArtifacts)).toEqual(['runs/run-1/report.json']);
  });

  it('persists a failed run with the report, real screenshot, and trace artifacts', async () => {
    const { service, testRunRepository, runner, savedArtifacts } = setup();
    runner.run.mockResolvedValue(failingOutcome());

    await service.executeRun('run-1');

    const savedRun = testRunRepository.save.mock.calls.at(-1)![0];
    expect(savedRun.status).toBe('failed');
    expect(savedRun.failureStep).toBe(2);
    expect(savedRun.errorMessage).toBe('Expected text "x"');

    expect(storageKeys(savedArtifacts)).toEqual([
      'runs/run-1/report.json',
      'runs/run-1/failure.png',
      'runs/run-1/trace.zip',
    ]);
    const screenshot = savedArtifacts.find((a) => a.type === 'screenshot');
    expect(screenshot!.contentType).toBe('image/png');
  });

  it('falls back to placeholder artifacts when real capture returned null', async () => {
    const { service, runner, savedArtifacts } = setup();
    runner.run.mockResolvedValue(
      failingOutcome({ screenshot: null, trace: null }),
    );

    await service.executeRun('run-1');

    expect(storageKeys(savedArtifacts)).toEqual([
      'runs/run-1/report.json',
      'runs/run-1/failure.svg',
      'runs/run-1/trace.placeholder.json',
    ]);
  });

  it('records a failed run when the runner itself throws', async () => {
    const { service, testRunRepository, runner } = setup();
    runner.run.mockRejectedValue(new Error('browser crashed'));

    await service.executeRun('run-1');

    const savedRun = testRunRepository.save.mock.calls.at(-1)![0];
    expect(savedRun.status).toBe('failed');
    expect(savedRun.failureStep).toBe(0);
    expect(savedRun.errorMessage).toBe('browser crashed');
  });

  it('does not fail the run when artifact persistence throws (best-effort)', async () => {
    const { service, testRunRepository, runner, storage } = setup();
    runner.run.mockResolvedValue(passingOutcome());
    storage.write.mockRejectedValueOnce(new Error('disk full'));

    const result = await service.executeRun('run-1');

    expect(result).toBeDefined();
    const savedRun = testRunRepository.save.mock.calls.at(-1)![0];
    expect(
      savedRun.logs.some((l: string) => l.includes('Failed to persist run artifacts')),
    ).toBe(true);
  });

  it('returns the freshly reloaded run via findOne', async () => {
    const { service, runner, testRunRepository } = setup();
    runner.run.mockResolvedValue(passingOutcome());

    const result = await service.executeRun('run-1');

    expect(testRunRepository.findOne).toHaveBeenLastCalledWith({
      where: { id: 'run-1' },
      relations: { artifacts: true, testDefinition: true },
    });
    expect(result).toMatchObject({ id: 'run-1', __fetched: true });
  });
});

describe('TestRunsService.findOne', () => {
  it('throws NotFoundException when the run is missing', async () => {
    const { service, testRunRepository } = setup();
    testRunRepository.findOne.mockResolvedValueOnce(null as never);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
