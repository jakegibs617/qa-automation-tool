import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateTestDefinitionDto } from './dto/create-test-definition.dto';
import { TestDefinitionsService } from './test-definitions.service';

@Controller()
export class TestDefinitionsController {
  constructor(private readonly testDefinitionsService: TestDefinitionsService) {}

  @Post('test-definitions')
  create(@Body() createTestDefinitionDto: CreateTestDefinitionDto) {
    return this.testDefinitionsService.create(createTestDefinitionDto);
  }

  @Get('projects/:projectId/test-definitions')
  findByProject(@Param('projectId') projectId: string) {
    return this.testDefinitionsService.findByProject(projectId);
  }

  @Get('projects/:projectId/test-definitions/:id')
  findOneForProject(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.testDefinitionsService.findOneForProject(projectId, id);
  }
}
