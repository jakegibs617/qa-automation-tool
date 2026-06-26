import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './database/data-source';
import { AiModule } from './ai/ai.module';
import { ArtifactsModule } from './artifacts/artifacts.module';
import { ProjectsModule } from './projects/projects.module';
import { TestDefinitionsModule } from './test-definitions/test-definitions.module';
import { TestRunsModule } from './test-runs/test-runs.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    AiModule,
    ArtifactsModule,
    ProjectsModule,
    TestDefinitionsModule,
    TestRunsModule,
  ],
})
export class AppModule {}
