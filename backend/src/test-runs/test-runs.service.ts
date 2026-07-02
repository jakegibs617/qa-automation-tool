import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TestDefinition } from '../test-definitions/test-definition.entity';
import { TestRun, TestRunStatus } from './test-run.entity';
import {
  PlaywrightRunnerService,
  RunnerOutcome,
} from './playwright-runner.service';
import { RunArtifactWriter } from './run-artifact-writer.service';
import { RunQueueService } from './run-queue.service';
import { buildRunReport } from './run-report';

@Injectable()
export class TestRunsService {
  constructor(
    @InjectRepository(TestRun)
    private readonly testRunRepository: Repository<TestRun>,
    @InjectRepository(TestDefinition)
    private readonly testDefinitionRepository: Repository<TestDefinition>,
    private readonly runner: PlaywrightRunnerService,
    private readonly artifactWriter: RunArtifactWriter,
    private readonly runQueue: RunQueueService,
  ) {}

  /**
   * Creates a `queued` run and hands execution to the background worker,
   * returning immediately so the request never blocks on a browser session.
   */
  async enqueueRun(testDefinitionId: string) {
    const testDefinition = await this.testDefinitionRepository.findOne({
      where: { id: testDefinitionId },
      relations: { project: true },
    });

    if (!testDefinition) {
      throw new NotFoundException('Test definition not found');
    }

    const testRun = await this.testRunRepository.save(
      this.testRunRepository.create({
        projectId: testDefinition.projectId,
        testDefinitionId: testDefinition.id,
        status: 'queued',
        logs: [`Run queued for "${testDefinition.name}"`],
      }),
    );

    try {
      await this.runQueue.enqueue(testRun.id);
    } catch (error) {
      // If the queue is unreachable, don't leave a run stuck in `queued`
      // forever (the UI polls pending runs indefinitely). Mark it failed.
      const message =
        error instanceof Error ? error.message : 'Failed to enqueue run';
      testRun.status = 'failed';
      testRun.errorMessage = `Could not enqueue run: ${message}`;
      testRun.failureStep = 0;
      testRun.logs = [...testRun.logs, `Failed to enqueue run: ${message}`];
      await this.testRunRepository.save(testRun);
    }

    return this.findOne(testRun.id);
  }

  /**
   * Executes a previously-queued run. Invoked by the worker off the request
   * path: transitions the run to `running`, drives Playwright, and persists the
   * outcome and artifacts.
   */
  async executeRun(runId: string) {
    let testRun = await this.testRunRepository.findOne({ where: { id: runId } });

    if (!testRun) {
      throw new NotFoundException('Test run not found');
    }

    const testDefinition = await this.testDefinitionRepository.findOne({
      where: { id: testRun.testDefinitionId },
      relations: { project: true },
    });

    if (!testDefinition) {
      testRun.status = 'failed';
      testRun.errorMessage = 'Test definition not found';
      testRun.failureStep = 0;
      testRun.logs = [...testRun.logs, 'Test definition not found'];
      await this.testRunRepository.save(testRun);
      return this.findOne(testRun.id);
    }

    testRun.status = 'running';
    testRun.logs = [
      ...testRun.logs,
      `Starting test run for "${testDefinition.name}"`,
    ];
    testRun = await this.testRunRepository.save(testRun);

    const startedAt = Date.now();

    let outcome: RunnerOutcome;
    try {
      outcome = await this.runner.run({
        baseUrl: testDefinition.project?.baseUrl ?? '',
        startUrl: testDefinition.startUrl,
        steps: testDefinition.steps,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Test runner crashed';
      outcome = {
        status: 'failed',
        steps: [],
        logs: [`Test runner error: ${message}`],
        failureStep: 0,
        errorMessage: message,
        screenshot: null,
        trace: null,
      };
    }

    const status: TestRunStatus = outcome.status;
    const logs = [
      ...testRun.logs,
      ...outcome.logs,
      status === 'passed'
        ? 'Test run completed successfully'
        : `Test run failed at step ${outcome.failureStep}`,
    ];

    const finishedAt = Date.now();
    testRun.status = status;
    testRun.durationMs = finishedAt - startedAt;
    testRun.failureStep = outcome.failureStep;
    testRun.errorMessage = outcome.errorMessage;
    testRun.logs = logs;
    testRun = await this.testRunRepository.save(testRun);

    const report = buildRunReport({
      runId: testRun.id,
      projectId: testRun.projectId,
      testDefinitionId: testDefinition.id,
      testDefinitionName: testDefinition.name,
      status,
      startedAt,
      finishedAt,
      failureStep: outcome.failureStep,
      errorMessage: outcome.errorMessage,
      steps: outcome.steps,
      logs,
    });

    // Artifact persistence is best-effort: a storage hiccup must not fail an
    // otherwise-completed run that is already saved.
    try {
      await this.artifactWriter.writeRunArtifacts(testRun, report, outcome);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown artifact error';
      testRun.logs = [...testRun.logs, `Failed to persist run artifacts: ${reason}`];
      await this.testRunRepository.save(testRun);
    }

    return this.findOne(testRun.id);
  }

  async reconcilePendingRuns() {
    const pendingRuns = await this.testRunRepository.find({
      where: { status: In(['queued', 'running']) },
    });

    const results = { runningFailed: 0, queuedFailed: 0 };

    for (const run of pendingRuns) {
      if (run.status === 'running') {
        await this.markRunFailed(
          run,
          'Run interrupted by worker restart',
          'Run interrupted by worker restart',
        );
        results.runningFailed += 1;
        continue;
      }

      const state = await this.runQueue.getRunJobState(run.id);
      if (['missing', 'failed', 'completed', 'unknown'].includes(state)) {
        await this.markRunFailed(
          run,
          `Queued run lost its worker job (${state})`,
          `Queued run could not be recovered because its queue job is ${state}`,
        );
        results.queuedFailed += 1;
      }
    }

    return results;
  }

  async markRunInterrupted(runId: string, reason: string) {
    const testRun = await this.testRunRepository.findOne({ where: { id: runId } });
    if (!testRun || isTerminalStatus(testRun.status)) {
      return testRun;
    }

    return this.markRunFailed(testRun, reason, reason);
  }

  findByProject(projectId: string) {
    return this.testRunRepository.find({
      where: { projectId },
      relations: { artifacts: true, testDefinition: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const testRun = await this.testRunRepository.findOne({
      where: { id },
      relations: { artifacts: true, testDefinition: true },
    });

    if (!testRun) {
      throw new NotFoundException('Test run not found');
    }

    return testRun;
  }

  private async markRunFailed(
    testRun: TestRun,
    errorMessage: string,
    logMessage: string,
  ) {
    testRun.status = 'failed';
    testRun.failureStep = testRun.failureStep ?? 0;
    testRun.errorMessage = errorMessage;
    testRun.logs = [...(testRun.logs ?? []), logMessage];
    return this.testRunRepository.save(testRun);
  }
}

function isTerminalStatus(status: TestRunStatus) {
  return ['passed', 'failed', 'canceled'].includes(status);
}
