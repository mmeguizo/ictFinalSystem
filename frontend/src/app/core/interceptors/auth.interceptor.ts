import { HttpInterceptorFn, HttpHandler, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
/**
 * Auth Interceptor
 * Automatically adds JWT token to outgoing HTTP requests
 * Retrieves token from AuthService and adds Authorization header
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip GraphQL requests handled by Apollo's authLink
  // (covers direct '/graphql' endpoint or any URL that includes '/graphql')
  if (req.url.includes('/graphql') || req.headers.has('X-Skip-Auth')) {
    return next(req);
  }

  // Prefer the token stored by AuthService (covers both local login and Auth0 SSO).
  // Fall back to the legacy 'auth_token' key written by login.page.ts so that
  // existing local-login sessions continue to work without a re-login.
  const authService = inject(AuthService);
  const token = authService.getToken() || localStorage.getItem('auth_token') || '';
  // Clone request and add Authorization header (existing logic)
  const authReq = req.clone({
    setHeaders: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });

  return next(authReq);
};
