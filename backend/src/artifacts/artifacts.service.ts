import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadStream } from 'node:fs';
import { Artifact } from './artifact.entity';
import { ArtifactStorageService } from './artifact-storage.service';

@Injectable()
export class ArtifactsService {
  constructor(
    @InjectRepository(Artifact)
    private readonly artifactRepository: Repository<Artifact>,
    private readonly storage: ArtifactStorageService,
  ) {}

  findByRun(testRunId: string) {
    return this.artifactRepository.find({
      where: { testRunId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: string) {
    const artifact = await this.artifactRepository.findOne({ where: { id } });

    if (!artifact) {
      throw new NotFoundException('Artifact not found');
    }

    return artifact;
  }

  async getContent(id: string): Promise<{ artifact: Artifact; stream: ReadStream }> {
    const artifact = await this.findOne(id);

    if (!(await this.storage.exists(artifact.storageKey))) {
      throw new NotFoundException('Artifact content not found');
    }

    return { artifact, stream: this.storage.createReadStream(artifact.storageKey) };
  }
}
