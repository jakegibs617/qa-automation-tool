import { strict as assert } from 'assert';

import dataSource from '../src/database/data-source';
import { Artifact } from '../src/artifacts/artifact.entity';
import { ArtifactStorageService } from '../src/artifacts/artifact-storage.service';
import { Project } from '../src/projects/project.entity';
import { TestDefinition } from '../src/test-definitions/test-definition.entity';
import { PlaywrightRunnerService } from '../src/test-runs/playwright-runner.service';
import { RunArtifactWriter } from '../src/test-runs/run-artifact-writer.service';
import { RunQueueService } from '../src/test-runs/run-queue.service';
import { TestRun } from '../src/test-runs/test-run.entity';
import { TestRunsService } from '../src/test-runs/test-runs.service';

async function main() {
  await dataSource.initialize();

  const projectRepository = dataSource.getRepository(Project);
  const definitionRepository = dataSource.getRepository(TestDefinition);
  const runRepository = dataSource.getRepository(TestRun);
  const artifactRepository = dataSource.getRepository(Artifact);
  const runQueue = new RunQueueService();
  const suffix = Date.now();

  let project: Project | null = null;

  try {
    project = await projectRepository.save(
      projectRepository.create({
        name: `Checkpoint 9 ${suffix}`,
        baseUrl: 'http://example.test',
      }),
    );
    const definition = await definitionRepository.save(
      definitionRepository.create({
        projectId: project.id,
        name: 'Worker recovery smoke',
        startUrl: '/',
        steps: [{ type: 'goto', url: '/' }],
      }),
    );

    const running = await runRepository.save(
      runRepository.create({
        projectId: project.id,
        testDefinitionId: definition.id,
        status: 'running',
        logs: ['Started before worker restart'],
      }),
    );
    const queued = await runRepository.save(
      runRepository.create({
        projectId: project.id,
        testDefinitionId: definition.id,
        status: 'queued',
        logs: ['Queued before worker restart'],
      }),
    );

    const service = new TestRunsService(
      runRepository,
      definitionRepository,
      {} as PlaywrightRunnerService,
      new RunArtifactWriter(artifactRepository, {} as ArtifactStorageService),
      runQueue,
    );

    const result = await service.reconcilePendingRuns();
    assert.deepEqual(result, { runningFailed: 1, queuedFailed: 1 });

    const recoveredRunning = await runRepository.findOneByOrFail({ id: running.id });
    const recoveredQueued = await runRepository.findOneByOrFail({ id: queued.id });
    assert.equal(recoveredRunning.status, 'failed');
    assert.equal(
      recoveredRunning.errorMessage,
      'Run interrupted by worker restart',
    );
    assert.equal(recoveredQueued.status, 'failed');
    assert.match(
      recoveredQueued.errorMessage ?? '',
      /Queued run lost its worker job/,
    );

    console.log('Checkpoint 9 smoke checks passed');
  } finally {
    if (project) {
      await projectRepository.delete(project.id);
    }
    await runQueue.onModuleDestroy();
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
