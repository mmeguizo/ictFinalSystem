import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export interface AuthUser {
  sub: string;
  email?: string;
  name?: string;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function verifyAuth0Token(token: string, domain: string, audience?: string): Promise<AuthUser | null> {
  try {
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
    }
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${domain}/`,
      audience,
    });
    return mapPayload(payload);
  } catch {
    return null;
  }
}

function mapPayload(payload: JWTPayload): AuthUser {
  return {
    sub: String(payload.sub ?? ''),
    email: typeof payload.email === 'string' ? payload.email : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  };
}

export interface Auth0UserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

// Fetches userinfo from Auth0 using the Access Token. Requires the token to have audience/scope enabled.
export async function getAuth0UserInfo(domain: string, accessToken: string): Promise<Auth0UserInfo | null> {
  try {
    const res = await fetch(`https://${domain}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Auth0UserInfo;
    if (!data || typeof data.sub !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}
