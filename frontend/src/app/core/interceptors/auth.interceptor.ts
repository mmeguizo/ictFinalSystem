import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Auth Interceptor
 * Automatically adds JWT token to outgoing HTTP requests
 * Retrieves token from AuthService and adds Authorization header
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Get token from auth service
  const token = authService.getToken();

  // If token exists, clone request and add Authorization header
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(req);
};
