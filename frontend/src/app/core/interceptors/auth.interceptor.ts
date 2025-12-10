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

  // Get token from auth service
  const token = localStorage.getItem('auth_token') || '';
  // Clone request and add Authorization header (existing logic)
  const authReq = req.clone({
    setHeaders: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });

  return next(authReq);
};
