import { NotFoundException } from '@nestjs/common';
import { TestRunsService } from './test-runs.service';
import { RunnerOutcome } from './playwright-runner.service';

type AnyMock = jest.Mock;

const buildDefinition = () => ({
  id: 'def-1',
  projectId: 'proj-1',
  name: 'Login flow',
  startUrl: '/login',
  steps: [{ type: 'goto', url: '/login' }],
  project: { baseUrl: 'http://base.test' },
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

const setup = (definition: ReturnType<typeof buildDefinition> | null) => {
  const savedArtifacts: Array<Record<string, unknown>> = [];

  const testRunRepository = {
    create: jest.fn((input) => ({ ...input })),
    save: jest.fn(async (run) => {
      if (!run.id) run.id = 'run-1';
      return run;
    }),
    findOne: jest.fn(async ({ where }) => ({ id: where.id, __fetched: true })),
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

  const service = new TestRunsService(
    testRunRepository as never,
    testDefinitionRepository as never,
    artifactRepository as never,
    runner as never,
    storage as never,
  );

  return {
    service,
    testRunRepository,
    testDefinitionRepository,
    artifactRepository,
    runner,
    storage,
    savedArtifacts,
  };
};

const storageKeys = (savedArtifacts: Array<Record<string, unknown>>) =>
  savedArtifacts.map((artifact) => artifact.storageKey as string);

describe('TestRunsService.runTestDefinition', () => {
  it('throws NotFoundException when the definition does not exist', async () => {
    const { service, runner } = setup(null);
    await expect(service.runTestDefinition('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('delegates to the runner with the project baseUrl, startUrl, and steps', async () => {
    const definition = buildDefinition();
    const { service, runner } = setup(definition);
    runner.run.mockResolvedValue(passingOutcome());

    await service.runTestDefinition('def-1');

    expect(runner.run).toHaveBeenCalledWith({
      baseUrl: 'http://base.test',
      startUrl: '/login',
      steps: definition.steps,
    });
  });

  it('persists a passing run with only the report.json log artifact', async () => {
    const { service, testRunRepository, runner, savedArtifacts } =
      setup(buildDefinition());
    runner.run.mockResolvedValue(passingOutcome());

    await service.runTestDefinition('def-1');

    const savedRun = testRunRepository.save.mock.calls.at(-1)![0];
    expect(savedRun.status).toBe('passed');
    expect(savedRun.failureStep).toBeNull();
    expect(savedRun.logs).toContain('Test run completed successfully');

    expect(storageKeys(savedArtifacts)).toEqual(['runs/run-1/report.json']);
  });

  it('persists a failed run with the report, real screenshot, and trace artifacts', async () => {
    const { service, testRunRepository, runner, savedArtifacts } =
      setup(buildDefinition());
    runner.run.mockResolvedValue(failingOutcome());

    await service.runTestDefinition('def-1');

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
    const { service, runner, savedArtifacts } = setup(buildDefinition());
    runner.run.mockResolvedValue(
      failingOutcome({ screenshot: null, trace: null }),
    );

    await service.runTestDefinition('def-1');

    expect(storageKeys(savedArtifacts)).toEqual([
      'runs/run-1/report.json',
      'runs/run-1/failure.svg',
      'runs/run-1/trace.placeholder.json',
    ]);
  });

  it('records a failed run when the runner itself throws', async () => {
    const { service, testRunRepository, runner } = setup(buildDefinition());
    runner.run.mockRejectedValue(new Error('browser crashed'));

    await service.runTestDefinition('def-1');

    const savedRun = testRunRepository.save.mock.calls.at(-1)![0];
    expect(savedRun.status).toBe('failed');
    expect(savedRun.failureStep).toBe(0);
    expect(savedRun.errorMessage).toBe('browser crashed');
  });

  it('does not fail the run when artifact persistence throws (best-effort)', async () => {
    const { service, testRunRepository, runner, storage } = setup(buildDefinition());
    runner.run.mockResolvedValue(passingOutcome());
    storage.write.mockRejectedValueOnce(new Error('disk full'));

    const result = await service.runTestDefinition('def-1');

    expect(result).toBeDefined();
    const savedRun = testRunRepository.save.mock.calls.at(-1)![0];
    expect(savedRun.logs.some((l: string) => l.includes('Failed to persist run artifacts'))).toBe(
      true,
    );
  });

  it('returns the freshly reloaded run via findOne', async () => {
    const { service, runner, testRunRepository } = setup(buildDefinition());
    runner.run.mockResolvedValue(passingOutcome());

    const result = await service.runTestDefinition('def-1');

    expect(testRunRepository.findOne).toHaveBeenLastCalledWith({
      where: { id: 'run-1' },
      relations: { artifacts: true, testDefinition: true },
    });
    expect(result).toMatchObject({ id: 'run-1', __fetched: true });
  });
});

describe('TestRunsService.findOne', () => {
  it('throws NotFoundException when the run is missing', async () => {
    const { service, testRunRepository } = setup(buildDefinition());
    testRunRepository.findOne.mockResolvedValueOnce(null as never);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
