import { Injectable } from '@nestjs/common';
import { createReadStream, ReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

/**
 * Local-disk artifact storage. MVP-first: artifacts are written under a single
 * base directory (configurable via ARTIFACTS_DIR) and addressed by a relative
 * storage key. This keeps the runner free of any S3-compatible dependency while
 * still producing real, downloadable artifact content.
 */
@Injectable()
export class ArtifactStorageService {
  private readonly baseDir = resolve(
    process.env.ARTIFACTS_DIR || join(process.cwd(), '.artifacts'),
  );

  /**
   * Resolve a storage key to an absolute path, guarding against path traversal
   * outside the configured base directory.
   */
  resolvePath(storageKey: string): string {
    const target = resolve(this.baseDir, storageKey);
    if (target !== this.baseDir && !target.startsWith(this.baseDir + sep)) {
      throw new Error(`Invalid storage key: ${storageKey}`);
    }
    return target;
  }

  async write(storageKey: string, content: Buffer | string): Promise<number> {
    const target = this.resolvePath(storageKey);
    await fs.mkdir(dirname(target), { recursive: true });
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    await fs.writeFile(target, buffer);
    return buffer.byteLength;
  }

  async read(storageKey: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(storageKey));
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  createReadStream(storageKey: string): ReadStream {
    return createReadStream(this.resolvePath(storageKey));
  }
}
