import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

@Injectable()
export class FileStorage {
  private readonly logger = new Logger(FileStorage.name);
  private readonly root = path.resolve(process.cwd(), 'uploads');

  async ensureRoot(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
  }

  /**
   * Compute sha256 of a buffer — used as the document contentHash for dedup.
   */
  hash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Persist a buffer under a sharded path based on its hash:
   * uploads/ab/cd/abcd...ef.docx
   * Sharding by the first 4 hex chars prevents one giant directory.
   */
  async write(buffer: Buffer, hash: string, extension: string): Promise<string> {
    await this.ensureRoot();
    const dir = path.join(this.root, hash.slice(0, 2), hash.slice(2, 4));
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${hash}${extension}`);
    await fs.writeFile(filePath, buffer);
    // Return path relative to backend root so it stays portable across hosts
    return path.relative(process.cwd(), filePath);
  }

  /** Resolve a stored relative path back to an absolute one for reading. */
  resolve(relativePath: string): string {
    return path.resolve(process.cwd(), relativePath);
  }

  async readBuffer(relativePath: string): Promise<Buffer> {
    return fs.readFile(this.resolve(relativePath));
  }

  /** Best-effort cleanup — used when a DB transaction rolls back after a write. */
  async tryDelete(relativePath: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(relativePath));
    } catch (e) {
      this.logger.warn(`Failed to delete orphan file ${relativePath}: ${e}`);
    }
  }
}