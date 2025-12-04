/**
 * Environment configuration
 * Centralized configuration for application settings
 */

export interface Environment {
  production: boolean;
  apiUrl: string;
  auth0: {
    domain: string;
    clientId: string;
    audience: string;
  };
}

export const environment: Environment = {
  production: false,
  apiUrl: 'http://localhost:4000/graphql',
  auth0: {
    domain: 'dev-r7i2pqcybdndjxwt.us.auth0.com',
    clientId: 'WkpoCJqPf7qphHyBAvNF3PWPuVIb8xfl',
    audience: 'https://ictsystem.api',
  },
};
