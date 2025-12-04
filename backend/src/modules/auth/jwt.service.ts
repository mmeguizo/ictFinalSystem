import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { authConfig } from '../../config/auth';
import { UnauthorizedError } from '../../lib/errors';
import { logger } from '../../lib/logger';

const JWT_SECRET = new TextEncoder().encode(authConfig.jwt.secret);

export interface JWTUser {
  sub: string;
  email: string;
  role: string;
}

export class JWTService {
  async sign(userId: number, email: string, role: string): Promise<string> {
    const token = await new SignJWT({
      sub: String(userId),
      email,
      role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(authConfig.jwt.expiresIn)
      .sign(JWT_SECRET);

    logger.debug(`JWT created for user ${userId}`);
    return token;
  }

  async verify(token: string): Promise<JWTUser | null> {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      
      if (!payload.sub || !payload.email || !payload.role) {
        return null;
      }

      return {
        sub: String(payload.sub),
        email: String(payload.email),
        role: String(payload.role),
      };
    } catch (error) {
      logger.debug('JWT verification failed:', error);
      return null;
    }
  }

  requireAuth(user: any): asserts user {
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }
  }

  requireRole(user: any, allowedRoles: string[]): void {
    this.requireAuth(user);
    if (!allowedRoles.includes(user.role)) {
      throw new UnauthorizedError(`Requires one of roles: ${allowedRoles.join(', ')}`);
    }
  }
}

export const jwtService = new JWTService();
