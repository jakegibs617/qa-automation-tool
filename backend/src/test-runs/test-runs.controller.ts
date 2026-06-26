import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { TestRunsService } from './test-runs.service';

@Controller()
export class TestRunsController {
  constructor(private readonly testRunsService: TestRunsService) {}

  @Post('test-definitions/:testDefinitionId/runs')
  @HttpCode(HttpStatus.ACCEPTED)
  runTestDefinition(@Param('testDefinitionId') testDefinitionId: string) {
    return this.testRunsService.enqueueRun(testDefinitionId);
  }

  @Get('projects/:projectId/runs')
  findByProject(@Param('projectId') projectId: string) {
    return this.testRunsService.findByProject(projectId);
  }

  @Get('test-runs/:id')
  findOne(@Param('id') id: string) {
    return this.testRunsService.findOne(id);
  }
}
