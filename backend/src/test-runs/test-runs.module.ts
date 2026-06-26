import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Artifact } from '../artifacts/artifact.entity';
import { ArtifactsModule } from '../artifacts/artifacts.module';
import { TestDefinition } from '../test-definitions/test-definition.entity';
import { PlaywrightRunnerService } from './playwright-runner.service';
import { StepDispatcherService } from './step-dispatcher.service';
import { TestRun } from './test-run.entity';
import { TestRunsController } from './test-runs.controller';
import { TestRunsService } from './test-runs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Artifact, TestDefinition, TestRun]),
    ArtifactsModule,
  ],
  controllers: [TestRunsController],
  providers: [StepDispatcherService, PlaywrightRunnerService, TestRunsService],
})
export class TestRunsModule {}
