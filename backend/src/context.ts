import { User } from '@prisma/client';
import type { IncomingMessage } from 'http';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';
import { jwtService } from './modules/auth/jwt.service';
import { auth0Service } from './modules/auth/auth0.service';
import { userService } from './modules/users/user.service';

export interface GraphQLContext {
  currentUser: User | null;
  userService: typeof userService;
  jwtService: typeof jwtService;
}

export async function createContext({ req }: { req: IncomingMessage }): Promise<GraphQLContext> {
  const authHeader = (req.headers?.authorization || '').toString();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  let currentUser: (User & { wasCreated?: boolean }) | null = null;
    console.log('JWT token:', token);
    console.log('JWT authHeader:', authHeader);

  // Try JWT (local login) first
  if (token) {
    const jwtUser = await jwtService.verify(token);
    console.log('JWT User:', jwtUser);
    if (jwtUser) {
      const userId = parseInt(jwtUser.sub, 10);
      if (!isNaN(userId)) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          currentUser = user;
          logger.debug(`Authenticated via JWT, user ID: ${userId}`);
        }
      }
    }
  }

  // If JWT failed, try Auth0
  if (!currentUser && token) {
    const auth0User = await auth0Service.verifyToken(token);
    if (auth0User?.sub) {
      // Try to get better profile info if missing
      let email = auth0User.email ?? null;
      let name = auth0User.name ?? null;
      let picture = auth0User.picture ?? null;

      if (!email || !name || !picture) {
        const info = await auth0Service.getUserInfo(token);
        if (info) {
          email = email ?? info.email ?? null;
          name = name ?? info.name ?? null;
          picture = picture ?? info.picture ?? null;
        }
      }

      const result = await userService.upsertFromAuth0(
        auth0User.sub,
        email ?? `${auth0User.sub}@example.com`,
        name,
        picture
      );

      currentUser = result.user;
      (currentUser as any).wasCreated = result.created;
      
      logger.debug(`Authenticated via Auth0, user ID: ${result.user.id}, created: ${result.created}`);
    }
  }

  return {
    currentUser,
    userService,
    jwtService,
  };
}
