import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

/**
 * Error Interceptor
 * Global error handling for HTTP requests
 * Catches errors and displays user-friendly messages
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unexpected error occurred';

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Error: ${error.error.message}`;
      } else {
        // Server-side error
        if (error.status === 0) {
          errorMessage = 'Unable to connect to server. Please check your connection.';
        } else if (error.status === 401) {
          errorMessage = 'Unauthorized. Please login again.';
        } else if (error.status === 403) {
          errorMessage = 'You do not have permission to perform this action.';
        } else if (error.status === 404) {
          errorMessage = 'Resource not found.';
        } else if (error.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else {
          // Try to extract message from GraphQL error response
          const graphqlError = error.error?.errors?.[0]?.message;
          if (graphqlError) {
            errorMessage = graphqlError;
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          } else {
            errorMessage = `Error: ${error.statusText}`;
          }
        }
      }

      // Display error notification
      notification.error(errorMessage);

      // Re-throw error for further handling if needed
      return throwError(() => error);
    })
  );
};
