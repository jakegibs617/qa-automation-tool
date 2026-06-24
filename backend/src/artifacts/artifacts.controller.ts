import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { basename } from 'node:path';
import { ArtifactsService } from './artifacts.service';

@Controller()
export class ArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  @Get('test-runs/:testRunId/artifacts')
  findByRun(@Param('testRunId') testRunId: string) {
    return this.artifactsService.findByRun(testRunId);
  }

  @Get('artifacts/:id')
  findOne(@Param('id') id: string) {
    return this.artifactsService.findOne(id);
  }

  @Get('artifacts/:id/content')
  async getContent(@Param('id') id: string): Promise<StreamableFile> {
    const { artifact, stream } = await this.artifactsService.getContent(id);

    return new StreamableFile(stream, {
      type: artifact.contentType ?? 'application/octet-stream',
      disposition: `inline; filename="${basename(artifact.storageKey)}"`,
    });
  }
}
