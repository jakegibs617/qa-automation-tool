import { Injectable, Logger } from '@nestjs/common';
import { chromium, type Browser } from 'playwright';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TestStepDto } from '../test-definitions/dto/test-step.dto';
import { resolveUrl, StepDispatcherService } from './step-dispatcher.service';
import { StepResult } from './run-report';

const DEFAULT_TIMEOUT_MS = Number(process.env.PLAYWRIGHT_TIMEOUT_MS ?? 15_000);

export type RunnerInput = {
  baseUrl: string;
  startUrl: string;
  steps: TestStepDto[];
};

export type RunnerOutcome = {
  status: 'passed' | 'failed';
  steps: StepResult[];
  logs: string[];
  /** Failing step number; 0 indicates failure during initial navigation. */
  failureStep: number | null;
  errorMessage: string | null;
  /** PNG screenshot captured on failure, otherwise null. */
  screenshot: Buffer | null;
  /** Playwright trace zip captured on failure, otherwise null. */
  trace: Buffer | null;
};

/**
 * Drives a real headless Chromium session for a single test run: navigates to
 * the start URL, executes each step via {@link StepDispatcherService}, and on
 * failure captures a real screenshot and Playwright trace. Operational test
 * failures are reported via the returned outcome rather than thrown.
 */
@Injectable()
export class PlaywrightRunnerService {
  private readonly logger = new Logger(PlaywrightRunnerService.name);

  constructor(private readonly dispatcher: StepDispatcherService) {}

  async run(input: RunnerInput): Promise<RunnerOutcome> {
    const logs: string[] = [];
    const steps: StepResult[] = [];
    let failureStep: number | null = null;
    let errorMessage: string | null = null;
    let screenshot: Buffer | null = null;
    let trace: Buffer | null = null;

    let browser: Browser | null = null;
    const traceDir = await mkdtemp(join(tmpdir(), 'qa-trace-'));
    const tracePath = join(traceDir, 'trace.zip');

    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      context.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
      await context.tracing.start({ screenshots: true, snapshots: true });
      const page = await context.newPage();

      const startUrl = resolveUrl(input.baseUrl, input.startUrl);
      try {
        await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
        logs.push(`Navigated to start URL ${startUrl}`);
      } catch (error) {
        failureStep = 0;
        errorMessage =
          error instanceof Error ? error.message : 'Failed to load start URL';
        logs.push(`Failed to navigate to start URL ${startUrl}: ${errorMessage}`);
      }

      if (failureStep === null) {
        for (const [index, step] of input.steps.entries()) {
          const stepNumber = index + 1;
          const stepStartedAt = Date.now();

          try {
            const result = await this.dispatcher.dispatch(page, step, stepNumber, {
              baseUrl: input.baseUrl,
            });
            logs.push(result.log);
            steps.push({
              stepNumber,
              type: step.type,
              status: 'passed',
              log: result.log,
              durationMs: Date.now() - stepStartedAt,
            });
          } catch (error) {
            failureStep = stepNumber;
            errorMessage =
              error instanceof Error ? error.message : 'Unknown runner error';
            const log = `${stepNumber}. ${step.type} failed: ${errorMessage}`;
            logs.push(log);
            steps.push({
              stepNumber,
              type: step.type,
              status: 'failed',
              log,
              durationMs: Date.now() - stepStartedAt,
            });
            break;
          }
        }
      }

      if (failureStep !== null) {
        screenshot = await page
          .screenshot({ fullPage: true })
          .catch((error) => {
            this.logger.warn(`Failed to capture screenshot: ${error}`);
            return null;
          });
        await context.tracing.stop({ path: tracePath }).catch(() => undefined);
        trace = await readFile(tracePath).catch(() => null);
      } else {
        await context.tracing.stop().catch(() => undefined);
      }

      await context.close();
    } finally {
      await browser?.close().catch(() => undefined);
      await rm(traceDir, { recursive: true, force: true }).catch(() => undefined);
    }

    return {
      status: failureStep === null ? 'passed' : 'failed',
      steps,
      logs,
      failureStep,
      errorMessage,
      screenshot,
      trace,
    };
  }
}
