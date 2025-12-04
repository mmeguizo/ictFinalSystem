import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../../config';
import { ValidationError } from '../../lib/errors';
import { logger } from '../../lib/logger';

export class StorageService {
  private readonly uploadsDir: string;
  private readonly profileDir: string;

  constructor() {
    this.uploadsDir = path.resolve(__dirname, '../../../uploads');
    this.profileDir = path.join(this.uploadsDir, 'profile');
    this.ensureDirectoriesExist();
  }

  private ensureDirectoriesExist(): void {
    [this.uploadsDir, this.profileDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    });
  }

  async saveAvatarFromDataUrl(dataUrl: string): Promise<string> {
    const parsed = this.parseDataUrl(dataUrl);
    if (!parsed) {
      throw new ValidationError('Invalid avatar data URL format');
    }
    return this.saveAvatarBuffer(parsed.buffer, parsed.ext);
  }

  async saveAvatarFromRemoteUrl(url: string): Promise<string | null> {
    if (typeof fetch !== 'function') {
      logger.warn('Fetch API not available, skipping avatar download');
      return null;
    }

    try {
      logger.debug(`Downloading avatar from: ${url}`);
      const response = await fetch(url, { redirect: 'follow' });
      
      if (!response.ok) {
        logger.warn(`Failed to download avatar: ${response.status}`);
        return null;
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const ext = contentType.split('/')[1] || 'bin';
      const arrayBuffer = await response.arrayBuffer();
      
      return this.saveAvatarBuffer(Buffer.from(arrayBuffer), ext);
    } catch (error) {
      logger.error('Error downloading avatar:', error);
      return null;
    }
  }

  private saveAvatarBuffer(buffer: Buffer, ext: string): string {
    const filename = `${randomUUID()}.${ext}`;
    const filePath = path.join(this.profileDir, filename);
    
    fs.writeFileSync(filePath, buffer);
    logger.debug(`Saved avatar: ${filename}`);
    
    return `${config.publicBaseUrl}/uploads/profile/${filename}`;
  }

  private parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer; ext: string } | null {
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!match) {
      return null;
    }

    const mime = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');
    const ext = mime.split('/')[1] || 'bin';

    return { mime, buffer, ext };
  }

  deleteAvatar(avatarUrl: string): void {
    try {
      const filename = path.basename(avatarUrl);
      const filePath = path.join(this.profileDir, filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.debug(`Deleted avatar: ${filename}`);
      }
    } catch (error) {
      logger.error('Error deleting avatar:', error);
    }
  }
}

// Singleton instance
export const storageService = new StorageService();
