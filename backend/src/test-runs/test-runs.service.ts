import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artifact } from '../artifacts/artifact.entity';
import { ArtifactStorageService } from '../artifacts/artifact-storage.service';
import { TestDefinition } from '../test-definitions/test-definition.entity';
import { TestRun, TestRunStatus } from './test-run.entity';
import {
  PlaywrightRunnerService,
  RunnerOutcome,
} from './playwright-runner.service';
import { RunQueueService } from './run-queue.service';
import {
  buildFailurePlaceholderSvg,
  buildRunReport,
  buildTracePlaceholder,
  RunReport,
} from './run-report';

@Injectable()
export class TestRunsService {
  constructor(
    @InjectRepository(TestRun)
    private readonly testRunRepository: Repository<TestRun>,
    @InjectRepository(TestDefinition)
    private readonly testDefinitionRepository: Repository<TestDefinition>,
    @InjectRepository(Artifact)
    private readonly artifactRepository: Repository<Artifact>,
    private readonly runner: PlaywrightRunnerService,
    private readonly storage: ArtifactStorageService,
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
      await this.writeRunArtifacts(testRun, report, outcome);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown artifact error';
      testRun.logs = [...testRun.logs, `Failed to persist run artifacts: ${reason}`];
      await this.testRunRepository.save(testRun);
    }

    return this.findOne(testRun.id);
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

  private async writeRunArtifacts(
    testRun: TestRun,
    report: RunReport,
    outcome: RunnerOutcome,
  ) {
    await this.saveArtifact(testRun, {
      type: 'log',
      storageKey: `runs/${testRun.id}/report.json`,
      contentType: 'application/json',
      content: JSON.stringify(report, null, 2),
    });

    if (report.status !== 'failed') {
      return;
    }

    // Prefer the real Playwright artifacts; fall back to self-describing
    // placeholders if capture failed (e.g. the browser crashed before a page
    // existed) so the artifact list is never empty for a failed run.
    if (outcome.screenshot) {
      await this.saveArtifact(testRun, {
        type: 'screenshot',
        storageKey: `runs/${testRun.id}/failure.png`,
        contentType: 'image/png',
        content: outcome.screenshot,
      });
    } else {
      await this.saveArtifact(testRun, {
        type: 'screenshot',
        storageKey: `runs/${testRun.id}/failure.svg`,
        contentType: 'image/svg+xml',
        content: buildFailurePlaceholderSvg(report),
      });
    }

    if (outcome.trace) {
      await this.saveArtifact(testRun, {
        type: 'trace',
        storageKey: `runs/${testRun.id}/trace.zip`,
        contentType: 'application/zip',
        content: outcome.trace,
      });
    } else {
      await this.saveArtifact(testRun, {
        type: 'trace',
        storageKey: `runs/${testRun.id}/trace.placeholder.json`,
        contentType: 'application/json',
        content: buildTracePlaceholder(report),
      });
    }
  }

  private async saveArtifact(
    testRun: TestRun,
    input: {
      type: Artifact['type'];
      storageKey: string;
      contentType: string;
      content: Buffer | string;
    },
  ) {
    const sizeBytes = await this.storage.write(input.storageKey, input.content);

    return this.artifactRepository.save(
      this.artifactRepository.create({
        projectId: testRun.projectId,
        testRunId: testRun.id,
        type: input.type,
        storageKey: input.storageKey,
        contentType: input.contentType,
        sizeBytes: String(sizeBytes),
      }),
    );
  }
}
