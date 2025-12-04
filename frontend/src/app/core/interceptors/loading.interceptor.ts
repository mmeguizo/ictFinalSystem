import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

/**
 * Loading Interceptor
 * Tracks HTTP request state to show/hide global loading indicator
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // Increment loading counter when request starts
  loadingService.startLoading();

  return next(req).pipe(
    // Decrement loading counter when request completes (success or error)
    finalize(() => loadingService.stopLoading())
  );
};
