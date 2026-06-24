import { TestRunStatus } from './test-run.entity';

export type StepResultStatus = 'passed' | 'failed' | 'skipped';

export type StepResult = {
  stepNumber: number;
  type: string;
  status: StepResultStatus;
  log: string;
  durationMs: number;
};

export type RunReport = {
  runId: string;
  projectId: string;
  testDefinitionId: string;
  testDefinitionName: string;
  status: TestRunStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  failureStep: number | null;
  errorMessage: string | null;
  steps: StepResult[];
  logs: string[];
};

/**
 * Pure builder for the structured run report that is persisted as the `log`
 * artifact. Kept free of NestJS/TypeORM so it can be unit-tested directly.
 */
export function buildRunReport(input: {
  runId: string;
  projectId: string;
  testDefinitionId: string;
  testDefinitionName: string;
  status: TestRunStatus;
  startedAt: number;
  finishedAt: number;
  failureStep: number | null;
  errorMessage: string | null;
  steps: StepResult[];
  logs: string[];
}): RunReport {
  return {
    runId: input.runId,
    projectId: input.projectId,
    testDefinitionId: input.testDefinitionId,
    testDefinitionName: input.testDefinitionName,
    status: input.status,
    startedAt: new Date(input.startedAt).toISOString(),
    finishedAt: new Date(input.finishedAt).toISOString(),
    durationMs: input.finishedAt - input.startedAt,
    failureStep: input.failureStep,
    errorMessage: input.errorMessage,
    steps: input.steps,
    logs: input.logs,
  };
}

const escapeXml = (value: string): string =>
  value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      default:
        return '&quot;';
    }
  });

/**
 * Placeholder "failure screenshot". Until full Playwright capture is wired up,
 * we emit a self-describing SVG so the artifact viewer has real, renderable
 * image content tied to the failing step.
 */
export function buildFailurePlaceholderSvg(report: RunReport): string {
  const failedStep = report.steps.find((step) => step.status === 'failed');
  const lines = [
    `Run ${report.runId.slice(0, 8)} failed`,
    failedStep ? `Step ${failedStep.stepNumber}: ${failedStep.type}` : 'Unknown step',
    report.errorMessage ? `Error: ${report.errorMessage}` : '',
  ].filter(Boolean);

  const body = lines
    .map(
      (line, index) =>
        `<text x="40" y="${120 + index * 40}" font-family="monospace" font-size="22" fill="#fca5a5">${escapeXml(
          line,
        )}</text>`,
    )
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
  <rect width="800" height="450" fill="#0f172a"/>
  <rect x="20" y="20" width="760" height="410" fill="none" stroke="#ef4444" stroke-width="2" rx="12"/>
  <text x="40" y="70" font-family="monospace" font-size="28" fill="#f8fafc">Failure screenshot (placeholder)</text>
  ${body}
</svg>
`;
}

/**
 * Placeholder trace record content. Full Playwright trace/video capture is
 * deferred for the MVP; this keeps a real, downloadable storage record so the
 * UI and storage plumbing are exercised end to end.
 */
export function buildTracePlaceholder(report: RunReport): string {
  return JSON.stringify(
    {
      note: 'Playwright trace/video capture is deferred for the MVP.',
      runId: report.runId,
      testDefinitionId: report.testDefinitionId,
      status: report.status,
      failureStep: report.failureStep,
      capturedSteps: report.steps.map((step) => ({
        stepNumber: step.stepNumber,
        type: step.type,
        status: step.status,
      })),
    },
    null,
    2,
  );
}
