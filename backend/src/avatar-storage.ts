import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const PROFILE_DIR = path.resolve(__dirname, '..', 'uploads', 'profile');
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';

function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function saveAvatarFromDataUrl(dataUrl: string): string {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw new Error('Invalid avatar data');
  }
  return saveAvatarBuffer(parsed.buffer, parsed.ext);
}

export async function saveAvatarFromRemoteUrl(url: string): Promise<string | null> {
  if (typeof fetch !== 'function') {
    return null;
  }
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const ext = contentType.split('/')[1] || 'bin';
    const arrayBuffer = await response.arrayBuffer();
    return saveAvatarBuffer(Buffer.from(arrayBuffer), ext);
  } catch {
    return null;
  }
}

function saveAvatarBuffer(buffer: Buffer, ext: string): string {
  ensureDirSync(PROFILE_DIR);
  const filename = `${randomUUID()}.${ext}`;
  const filePath = path.join(PROFILE_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return `${PUBLIC_BASE}/uploads/profile/${filename}`;
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer; ext: string } | null {
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
