import {
  buildFailurePlaceholderSvg,
  buildRunReport,
  buildTracePlaceholder,
  StepResult,
} from './run-report';

const baseInput = {
  runId: '11111111-2222-3333-4444-555555555555',
  projectId: 'proj-1',
  testDefinitionId: 'def-1',
  testDefinitionName: 'Login flow',
  startedAt: Date.UTC(2026, 0, 1, 0, 0, 0),
  finishedAt: Date.UTC(2026, 0, 1, 0, 0, 5),
  failureStep: null as number | null,
  errorMessage: null as string | null,
  steps: [] as StepResult[],
  logs: ['Starting test run'] as string[],
};

const passingStep: StepResult = {
  stepNumber: 1,
  type: 'goto',
  status: 'passed',
  log: '1. goto /',
  durationMs: 12,
};

const failingStep: StepResult = {
  stepNumber: 2,
  type: 'assertText',
  status: 'failed',
  log: '2. assertText failed',
  durationMs: 34,
};

describe('buildRunReport', () => {
  it('serializes timestamps to ISO strings and computes duration', () => {
    const report = buildRunReport({
      ...baseInput,
      status: 'passed',
      steps: [passingStep],
    });

    expect(report.startedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(report.finishedAt).toBe('2026-01-01T00:00:05.000Z');
    expect(report.durationMs).toBe(5000);
  });

  it('carries through identity, status, and step/log payloads verbatim', () => {
    const report = buildRunReport({
      ...baseInput,
      status: 'failed',
      failureStep: 2,
      errorMessage: 'Expected text "x"',
      steps: [passingStep, failingStep],
      logs: ['a', 'b'],
    });

    expect(report).toMatchObject({
      runId: baseInput.runId,
      projectId: 'proj-1',
      testDefinitionId: 'def-1',
      testDefinitionName: 'Login flow',
      status: 'failed',
      failureStep: 2,
      errorMessage: 'Expected text "x"',
      logs: ['a', 'b'],
    });
    expect(report.steps).toHaveLength(2);
    expect(report.steps[1]).toEqual(failingStep);
  });
});

describe('buildFailurePlaceholderSvg', () => {
  const failedReport = buildRunReport({
    ...baseInput,
    status: 'failed',
    failureStep: 2,
    errorMessage: 'Expected text "Goodbye"',
    steps: [passingStep, failingStep],
  });

  it('produces a valid SVG document referencing the failing step and error', () => {
    const svg = buildFailurePlaceholderSvg(failedReport);

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Step 2: assertText');
    // The error text is XML-escaped (quotes -> &quot;).
    expect(svg).toContain('Error: Expected text &quot;Goodbye&quot;');
    expect(svg).toContain(failedReport.runId.slice(0, 8));
  });

  it('escapes XML-sensitive characters in the error message', () => {
    const svg = buildFailurePlaceholderSvg(
      buildRunReport({
        ...baseInput,
        status: 'failed',
        failureStep: 1,
        errorMessage: '<script> & "danger"',
        steps: [{ ...failingStep, stepNumber: 1 }],
      }),
    );

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt; &amp; &quot;danger&quot;');
  });

  it('falls back to "Unknown step" when no failed step is present', () => {
    const svg = buildFailurePlaceholderSvg(
      buildRunReport({
        ...baseInput,
        status: 'failed',
        failureStep: 0,
        errorMessage: 'nav failed',
        steps: [],
      }),
    );

    expect(svg).toContain('Unknown step');
  });
});

describe('buildTracePlaceholder', () => {
  it('emits parseable JSON summarizing each captured step', () => {
    const report = buildRunReport({
      ...baseInput,
      status: 'failed',
      failureStep: 2,
      errorMessage: 'boom',
      steps: [passingStep, failingStep],
    });

    const parsed = JSON.parse(buildTracePlaceholder(report));

    expect(parsed.runId).toBe(report.runId);
    expect(parsed.failureStep).toBe(2);
    expect(parsed.capturedSteps).toEqual([
      { stepNumber: 1, type: 'goto', status: 'passed' },
      { stepNumber: 2, type: 'assertText', status: 'failed' },
    ]);
  });
});
