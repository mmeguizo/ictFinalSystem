import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../services/auth.service';

/**
 * Error Interceptor
 * Global error handling for HTTP requests
 * Catches errors and displays user-friendly messages
 * Auto-logs out user on 401 Unauthorized errors
 * Also checks successful (HTTP 200) GraphQL responses for auth errors
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notification = inject(NotificationService);
  const authService = inject(AuthService);

  return next(req).pipe(
    // Check successful responses for GraphQL auth errors (HTTP 200 with errors in body)
    tap((event: any) => {
      if (event?.body?.errors && Array.isArray(event.body.errors)) {
        for (const gqlError of event.body.errors) {
          const code = gqlError?.extensions?.code;
          const msg = (gqlError?.message || '').toLowerCase();
          if (
            code === 'UNAUTHENTICATED' ||
            code === 'UNAUTHORIZED' ||
            msg.includes('session expired') ||
            msg.includes('jwt expired') ||
            msg.includes('invalid token') ||
            msg.includes('token expired')
          ) {
            console.warn('[ErrorInterceptor] GraphQL auth error in 200 response, logging out');
            authService.logout();
            return;
          }
        }
      }
    }),
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unexpected error occurred';
      let shouldLogout = false;

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Error: ${error.error.message}`;
      } else {
        // Server-side error
        if (error.status === 0) {
          errorMessage = 'Unable to connect to server. Please check your connection.';
        } else if (error.status === 401) {
          errorMessage = 'Session expired. Please login again.';
          shouldLogout = true;
        } else if (error.status === 403) {
          errorMessage = 'You do not have permission to perform this action.';
        } else if (error.status === 404) {
          errorMessage = 'Resource not found.';
        } else if (error.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else {
          // Try to extract message from GraphQL error response
          const graphqlErrors = error.error?.errors;
          if (graphqlErrors && Array.isArray(graphqlErrors)) {
            for (const gqlError of graphqlErrors) {
              const msg = gqlError?.message?.toLowerCase() || '';
              if (
                msg.includes('unauthorized') ||
                msg.includes('jwt expired') ||
                msg.includes('invalid token') ||
                gqlError?.extensions?.code === 'UNAUTHENTICATED'
              ) {
                errorMessage = 'Session expired. Please login again.';
                shouldLogout = true;
                break;
              }
            }
            if (!shouldLogout && graphqlErrors[0]?.message) {
              errorMessage = graphqlErrors[0].message;
            }
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          } else {
            errorMessage = `Error: ${error.statusText}`;
          }
        }
      }

      // Auto-logout on authentication errors
      if (shouldLogout) {
        console.warn('[ErrorInterceptor] Authentication error, logging out user');
        authService.logout();
        return throwError(() => error);
      }

      // Display error notification
      notification.error(errorMessage);

      // Re-throw error for further handling if needed
      return throwError(() => error);
    })
  );
};
