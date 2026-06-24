import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/project.entity';
import { TestDefinition } from './test-definition.entity';
import { TestDefinitionsController } from './test-definitions.controller';
import { TestDefinitionsService } from './test-definitions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, TestDefinition])],
  controllers: [TestDefinitionsController],
  providers: [TestDefinitionsService],
  exports: [TestDefinitionsService],
})
export class TestDefinitionsModule {}
