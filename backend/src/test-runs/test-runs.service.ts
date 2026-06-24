import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artifact } from '../artifacts/artifact.entity';
import { ArtifactStorageService } from '../artifacts/artifact-storage.service';
import { TestDefinition } from '../test-definitions/test-definition.entity';
import { TestRun, TestRunStatus } from './test-run.entity';
import { StepDispatcherService } from './step-dispatcher.service';
import {
  buildFailurePlaceholderSvg,
  buildRunReport,
  buildTracePlaceholder,
  RunReport,
  StepResult,
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
    private readonly stepDispatcher: StepDispatcherService,
    private readonly storage: ArtifactStorageService,
  ) {}

  async runTestDefinition(testDefinitionId: string) {
    const testDefinition = await this.testDefinitionRepository.findOne({
      where: { id: testDefinitionId },
    });

    if (!testDefinition) {
      throw new NotFoundException('Test definition not found');
    }

    let testRun = await this.testRunRepository.save(
      this.testRunRepository.create({
        projectId: testDefinition.projectId,
        testDefinitionId: testDefinition.id,
        status: 'running',
        logs: [`Starting test run for "${testDefinition.name}"`],
      }),
    );

    const startedAt = Date.now();
    const logs: string[] = [`Starting test run for "${testDefinition.name}"`];
    const steps: StepResult[] = [];
    let failureStep: number | null = null;
    let errorMessage: string | null = null;

    for (const [index, step] of testDefinition.steps.entries()) {
      const stepNumber = index + 1;
      const stepStartedAt = Date.now();

      try {
        const result = await this.stepDispatcher.dispatch(step, stepNumber);
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
        errorMessage = error instanceof Error ? error.message : 'Unknown runner error';
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

    const status: TestRunStatus = failureStep === null ? 'passed' : 'failed';
    logs.push(
      status === 'passed'
        ? 'Test run completed successfully'
        : `Test run failed at step ${failureStep}`,
    );

    const finishedAt = Date.now();
    testRun.status = status;
    testRun.durationMs = finishedAt - startedAt;
    testRun.failureStep = failureStep;
    testRun.errorMessage = errorMessage;
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
      failureStep,
      errorMessage,
      steps,
      logs,
    });

    // Artifact persistence is best-effort: a storage hiccup must not fail an
    // otherwise-completed run that is already saved.
    try {
      await this.writeRunArtifacts(testRun, report);
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

  private async writeRunArtifacts(testRun: TestRun, report: RunReport) {
    await this.saveArtifact(testRun, {
      type: 'log',
      storageKey: `runs/${testRun.id}/report.json`,
      contentType: 'application/json',
      content: JSON.stringify(report, null, 2),
    });

    if (report.status === 'failed') {
      await this.saveArtifact(testRun, {
        type: 'screenshot',
        storageKey: `runs/${testRun.id}/failure.svg`,
        contentType: 'image/svg+xml',
        content: buildFailurePlaceholderSvg(report),
      });

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
      content: string;
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
