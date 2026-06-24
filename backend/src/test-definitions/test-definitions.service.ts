import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/project.entity';
import { CreateTestDefinitionDto } from './dto/create-test-definition.dto';
import { TestDefinition } from './test-definition.entity';

@Injectable()
export class TestDefinitionsService {
  constructor(
    @InjectRepository(TestDefinition)
    private readonly testDefinitionRepository: Repository<TestDefinition>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async create(createTestDefinitionDto: CreateTestDefinitionDto) {
    const project = await this.projectRepository.findOneBy({
      id: createTestDefinitionDto.projectId,
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const testDefinition = this.testDefinitionRepository.create(createTestDefinitionDto);
    return this.testDefinitionRepository.save(testDefinition);
  }

  findByProject(projectId: string) {
    return this.testDefinitionRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneForProject(projectId: string, id: string) {
    const testDefinition = await this.testDefinitionRepository.findOne({
      where: { id, projectId },
    });

    if (!testDefinition) {
      throw new NotFoundException('Test definition not found');
    }

    return testDefinition;
  }

  async findOne(id: string) {
    const testDefinition = await this.testDefinitionRepository.findOne({
      where: { id },
    });

    if (!testDefinition) {
      throw new NotFoundException('Test definition not found');
    }

    return testDefinition;
  }
}
