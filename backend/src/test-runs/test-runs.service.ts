import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artifact } from '../artifacts/artifact.entity';
import { TestDefinition } from '../test-definitions/test-definition.entity';
import { TestRun } from './test-run.entity';
import { StepDispatcherService } from './step-dispatcher.service';

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
    let failedStep: number | null = null;
    let errorMessage: string | null = null;

    try {
      for (const [index, step] of testDefinition.steps.entries()) {
        const stepNumber = index + 1;
        failedStep = stepNumber;
        const result = await this.stepDispatcher.dispatch(step, stepNumber);
        testRun.logs = [...testRun.logs, result.log];
      }

      failedStep = null;
      testRun.status = 'passed';
      testRun.logs = [...testRun.logs, 'Test run completed successfully'];
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown runner error';
      testRun.status = 'failed';
      testRun.logs = [...testRun.logs, errorMessage];
    }

    testRun.durationMs = Date.now() - startedAt;
    testRun.failureStep = failedStep;
    testRun.errorMessage = errorMessage;
    testRun = await this.testRunRepository.save(testRun);

    await this.createLogArtifact(testRun);

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

  private createLogArtifact(testRun: TestRun) {
    const body = JSON.stringify(testRun.logs, null, 2);

    return this.artifactRepository.save(
      this.artifactRepository.create({
        projectId: testRun.projectId,
        testRunId: testRun.id,
        type: 'log',
        storageKey: `runs/${testRun.id}/logs.json`,
        contentType: 'application/json',
        sizeBytes: String(Buffer.byteLength(body)),
      }),
    );
  }
}
