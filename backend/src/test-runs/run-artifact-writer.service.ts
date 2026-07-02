import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artifact } from '../artifacts/artifact.entity';
import { ArtifactStorageService } from '../artifacts/artifact-storage.service';
import { RunnerOutcome } from './playwright-runner.service';
import {
  buildFailurePlaceholderSvg,
  buildTracePlaceholder,
  RunReport,
} from './run-report';
import { TestRun } from './test-run.entity';

/**
 * Persists the artifacts produced by a completed run: the report JSON always,
 * plus failure evidence (screenshot and trace) when the run failed.
 *
 * Kept separate from run lifecycle orchestration: what gets stored, under
 * which keys, and with which fallbacks changes for storage/product reasons,
 * not run-state reasons.
 */
@Injectable()
export class RunArtifactWriter {
  constructor(
    @InjectRepository(Artifact)
    private readonly artifactRepository: Repository<Artifact>,
    private readonly storage: ArtifactStorageService,
  ) {}

  async writeRunArtifacts(
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
