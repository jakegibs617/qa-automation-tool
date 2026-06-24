import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Artifact } from './artifact.entity';
import { ArtifactStorageService } from './artifact-storage.service';
import { ArtifactsController } from './artifacts.controller';
import { ArtifactsService } from './artifacts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Artifact])],
  controllers: [ArtifactsController],
  providers: [ArtifactStorageService, ArtifactsService],
  exports: [ArtifactStorageService],
})
export class ArtifactsModule {}
