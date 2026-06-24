import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Artifact } from '../artifacts/artifact.entity';
import { TestDefinition } from '../test-definitions/test-definition.entity';
import { StepDispatcherService } from './step-dispatcher.service';
import { TestRun } from './test-run.entity';
import { TestRunsController } from './test-runs.controller';
import { TestRunsService } from './test-runs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Artifact, TestDefinition, TestRun])],
  controllers: [TestRunsController],
  providers: [StepDispatcherService, TestRunsService],
})
export class TestRunsModule {}
