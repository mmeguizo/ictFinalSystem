export const authConfig = {
  auth0: {
    domain: process.env.AUTH0_DOMAIN || '',
    audience: process.env.AUTH0_AUDIENCE || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};
