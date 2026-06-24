import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './database/data-source';
import { ProjectsModule } from './projects/projects.module';
import { TestDefinitionsModule } from './test-definitions/test-definitions.module';
import { TestRunsModule } from './test-runs/test-runs.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    ProjectsModule,
    TestDefinitionsModule,
    TestRunsModule,
  ],
})
export class AppModule {}
