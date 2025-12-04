import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { authConfig } from '../../config/auth';
import { logger } from '../../lib/logger';

export interface Auth0User {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface Auth0UserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export class Auth0Service {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  async verifyToken(token: string): Promise<Auth0User | null> {
    if (!authConfig.auth0.domain) {
      logger.warn('Auth0 domain not configured');
      return null;
    }

    try {
      if (!this.jwks) {
        this.jwks = createRemoteJWKSet(
          new URL(`https://${authConfig.auth0.domain}/.well-known/jwks.json`)
        );
      }

      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: `https://${authConfig.auth0.domain}/`,
        audience: authConfig.auth0.audience,
      });

      return this.mapPayload(payload);
    } catch (error) {
      logger.debug('Auth0 token verification failed:', error);
      return null;
    }
  }

  async getUserInfo(accessToken: string): Promise<Auth0UserInfo | null> {
    if (!authConfig.auth0.domain) {
      return null;
    }

    try {
      const res = await fetch(`https://${authConfig.auth0.domain}/userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        logger.warn(`Auth0 userinfo request failed: ${res.status}`);
        return null;
      }

      const data = (await res.json()) as Auth0UserInfo;
      if (!data || typeof data.sub !== 'string') {
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error fetching Auth0 userinfo:', error);
      return null;
    }
  }

  private mapPayload(payload: JWTPayload): Auth0User {
    return {
      sub: String(payload.sub ?? ''),
      email: typeof payload.email === 'string' ? payload.email : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
  }
}

export const auth0Service = new Auth0Service();
