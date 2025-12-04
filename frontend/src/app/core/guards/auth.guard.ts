import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Auth Guard
 * Protects routes from unauthenticated users
 * Redirects to login if user is not authenticated
 *
 * Usage in routes:
 * {
 *   path: 'dashboard',
 *   component: DashboardPage,
 *   canActivate: [authGuard]
 * }
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirect to login
  return router.createUrlTree(['/login']);
};

/**
 * Role Guard Factory
 * Creates a guard that checks for specific roles
 *
 * Usage in routes:
 * {
 *   path: 'admin',
 *   component: AdminPage,
 *   canActivate: [roleGuard(['ADMIN'])]
 * }
 */
export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }

    if (authService.hasAnyRole(allowedRoles)) {
      return true;
    }

    // User doesn't have required role - redirect to dashboard
    return router.createUrlTree(['/dashboard']);
  };
}

/**
 * Admin Guard
 * Convenience guard for admin-only routes
 */
export const adminGuard: CanActivateFn = roleGuard(['ADMIN']);

/**
 * Developer Guard
 * Convenience guard for admin and developer routes
 */
export const developerGuard: CanActivateFn = roleGuard(['ADMIN', 'DEVELOPER']);
