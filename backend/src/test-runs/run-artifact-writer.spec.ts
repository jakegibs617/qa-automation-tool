import { RunArtifactWriter } from './run-artifact-writer.service';
import { RunnerOutcome } from './playwright-runner.service';
import { RunReport } from './run-report';
import { TestRun } from './test-run.entity';

const buildRun = () =>
  ({ id: 'run-1', projectId: 'proj-1' }) as TestRun;

const buildReport = (status: 'passed' | 'failed'): RunReport =>
  ({
    runId: 'run-1',
    projectId: 'proj-1',
    testDefinitionId: 'def-1',
    testDefinitionName: 'Login flow',
    status,
    startedAt: new Date(0).toISOString(),
    finishedAt: new Date(1000).toISOString(),
    durationMs: 1000,
    failureStep: status === 'failed' ? 2 : null,
    errorMessage: status === 'failed' ? 'Expected text "x"' : null,
    steps: [],
    logs: [],
  }) as unknown as RunReport;

const buildOutcome = (overrides: Partial<RunnerOutcome> = {}): RunnerOutcome => ({
  status: 'failed',
  steps: [],
  logs: [],
  failureStep: 2,
  errorMessage: 'Expected text "x"',
  screenshot: Buffer.from('\x89PNG fake'),
  trace: Buffer.from('PK fake'),
  ...overrides,
});

const setup = () => {
  const savedArtifacts: Array<Record<string, unknown>> = [];
  const artifactRepository = {
    create: jest.fn((input) => ({ ...input })),
    save: jest.fn(async (artifact) => {
      savedArtifacts.push(artifact);
      return artifact;
    }),
  };
  const storage = {
    write: jest.fn(async (_key: string, _content: Buffer | string) => 1234),
  };

  const writer = new RunArtifactWriter(
    artifactRepository as never,
    storage as never,
  );

  return { writer, artifactRepository, storage, savedArtifacts };
};

describe('RunArtifactWriter', () => {
  it('writes only the report.json log artifact for a passing run', async () => {
    const { writer, storage, savedArtifacts } = setup();

    await writer.writeRunArtifacts(
      buildRun(),
      buildReport('passed'),
      buildOutcome({ status: 'passed', failureStep: null, errorMessage: null }),
    );

    expect(savedArtifacts.map((a) => a.storageKey)).toEqual([
      'runs/run-1/report.json',
    ]);
    expect(savedArtifacts[0]).toMatchObject({
      projectId: 'proj-1',
      testRunId: 'run-1',
      type: 'log',
      contentType: 'application/json',
      sizeBytes: '1234',
    });
    const [, reportContent] = storage.write.mock.calls[0];
    expect(JSON.parse(reportContent as string)).toMatchObject({ runId: 'run-1' });
  });

  it('writes report, real screenshot, and real trace for a failed run', async () => {
    const { writer, savedArtifacts } = setup();

    await writer.writeRunArtifacts(buildRun(), buildReport('failed'), buildOutcome());

    expect(savedArtifacts.map((a) => a.storageKey)).toEqual([
      'runs/run-1/report.json',
      'runs/run-1/failure.png',
      'runs/run-1/trace.zip',
    ]);
    expect(savedArtifacts[1]).toMatchObject({
      type: 'screenshot',
      contentType: 'image/png',
    });
    expect(savedArtifacts[2]).toMatchObject({
      type: 'trace',
      contentType: 'application/zip',
    });
  });

  it('falls back to placeholder artifacts when capture returned null', async () => {
    const { writer, storage, savedArtifacts } = setup();

    await writer.writeRunArtifacts(
      buildRun(),
      buildReport('failed'),
      buildOutcome({ screenshot: null, trace: null }),
    );

    expect(savedArtifacts.map((a) => a.storageKey)).toEqual([
      'runs/run-1/report.json',
      'runs/run-1/failure.svg',
      'runs/run-1/trace.placeholder.json',
    ]);
    expect(savedArtifacts[1]).toMatchObject({
      type: 'screenshot',
      contentType: 'image/svg+xml',
    });
    const svgContent = storage.write.mock.calls[1][1] as string;
    expect(svgContent).toContain('<svg');
  });

  it('propagates storage errors so the caller can apply best-effort handling', async () => {
    const { writer, storage } = setup();
    storage.write.mockRejectedValueOnce(new Error('disk full'));

    await expect(
      writer.writeRunArtifacts(buildRun(), buildReport('passed'), buildOutcome()),
    ).rejects.toThrow('disk full');
  });
});
