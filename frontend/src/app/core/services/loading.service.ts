import { Injectable, signal, computed } from '@angular/core';

/**
 * Loading Service
 * Manages global loading state using signals
 * Tracks multiple concurrent requests
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  // Track number of active requests
  private readonly loadingCount = signal(0);

  // Public computed signal - true if any requests are active
  readonly isLoading = computed(() => this.loadingCount() > 0);

  /**
   * Increment loading counter when a request starts
   */
  startLoading(): void {
    this.loadingCount.update(count => count + 1);
  }

  /**
   * Decrement loading counter when a request completes
   */
  stopLoading(): void {
    this.loadingCount.update(count => Math.max(0, count - 1));
  }

  /**
   * Force reset loading state (useful for error recovery)
   */
  reset(): void {
    this.loadingCount.set(0);
  }
}
