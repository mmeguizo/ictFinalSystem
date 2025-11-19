import { PrismaClient } from '@prisma/client';
import type { IncomingMessage } from 'http';
import { jwtVerify } from 'jose';
import { getAuth0UserInfo, verifyAuth0Token } from './auth';
import { saveAvatarFromRemoteUrl } from './avatar-storage';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

export async function createContext({ req }: { req: IncomingMessage }) {
  const authHeader = (req.headers?.authorization || '').toString();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const domain = process.env.AUTH0_DOMAIN || '';
  const audience = process.env.AUTH0_AUDIENCE || undefined;

  let currentUser: { id: number } | null = null;

  // Try JWT (local login) first
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      if (payload.sub) {
        const userId = parseInt(String(payload.sub), 10);
        if (!isNaN(userId)) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
          });
          if (user) {
            currentUser = user;
            console.log('Authenticated via JWT (local login), user ID:', userId);
          }
        }
      }
    } catch (jwtErr) {
      // JWT verification failed, try Auth0
    }
  }

  // If JWT failed and Auth0 is configured, try Auth0
  if (!currentUser && token && domain) {
    const verified = await verifyAuth0Token(token, domain, audience);
    if (verified?.sub) {
      // Try to get better profile info if missing
      let email = verified.email ?? null;
      let name = verified.name ?? null;
      let picture: string | null = (typeof (verified as any).picture === 'string'
        ? (verified as any).picture
        : null);
      if (!email || !name || !picture) {
        const info = await getAuth0UserInfo(domain, token);
        if (info) {
          email = (email ?? info.email) ?? null;
          name = (name ?? info.name) ?? null;
          picture = (picture ?? info.picture) ?? null;
        }
      }
      // Check if user already exists to compute a 'created' flag and determine avatar overrides
      const existing = await prisma.user.findUnique({
        where: { externalId: verified.sub },
        select: { id: true, avatarUrl: true },
      });
      let downloadedAvatar: string | null = null;
      if (!existing?.avatarUrl && picture && isHttpUrl(picture)) {
        downloadedAvatar = await saveAvatarFromRemoteUrl(picture);
      }

      const avatarForCreate = downloadedAvatar ?? picture ?? null;

      const user = await prisma.user.upsert({
        where: { externalId: verified.sub },
        create: {
          externalId: verified.sub,
          email: email ?? `${verified.sub}@example.com`,
          name,
          picture,
          avatarUrl: avatarForCreate,
          lastLoginAt: new Date(),
        },
        update: {
          email: email ?? undefined,
          name: name ?? undefined,
          picture: picture ?? undefined,
          ...(downloadedAvatar ? { avatarUrl: downloadedAvatar } : {}),
          lastLoginAt: new Date(),
        },
        select: { id: true },
      });
      currentUser = user;
      (currentUser as any).wasCreated = !existing;
    }
  }

  return { prisma, currentUser };
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
