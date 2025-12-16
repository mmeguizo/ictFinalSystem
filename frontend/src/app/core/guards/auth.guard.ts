import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Auth Guard
 * Protects routes from unauthenticated users
 * Redirects to login if user is not authenticated
 *
 * Waits for auth initialization to prevent login page flash on refresh
 *
 * Usage in routes:
 * {
 *   path: 'dashboard',
 *   component: DashboardPage,
 *   canActivate: [authGuard]
 * }
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('[GUARD] 🛡️ authGuard called for:', state.url);
  console.log('[GUARD] initialized:', authService.initialized(), 'isAuthenticated:', authService.isAuthenticated());

  // By the time guards run, APP_INITIALIZER should have completed
  // But just in case, check initialization state
  if (!authService.initialized()) {
    console.warn('[GUARD] ⚠️ Auth guard ran before initialization completed - redirecting to login');
    return router.createUrlTree(['/login']);
  }

  if (authService.isAuthenticated()) {
    console.log('[GUARD] ✅ User is authenticated - allowing access');
    return true;
  }

  // User not authenticated - redirect to login
  console.log('[GUARD] ❌ User not authenticated - redirecting to login');
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

    // Wait for initialization to complete (prevents flash on page reload)
    if (!authService.initialized()) {
      return false;
    }

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


/**
 * Approver Guard
 * Convenience guard for approver-only routes
 */
export const approverGuard: CanActivateFn = roleGuard(['ADMIN','SECRETARY','DIRECTOR','OFFICE_HEAD']);

/**
 * Guest Guard
 * Redirects authenticated users away from public pages (like login)
 * Prevents seeing login page flash when already authenticated
 *
 * Usage in routes:
 * {
 *   path: 'login',
 *   component: LoginPage,
 *   canActivate: [guestGuard]
 * }
 */
export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('[GUARD] 👋 guestGuard called for:', state.url);
  console.log('[GUARD] initialized:', authService.initialized(), 'isAuthenticated:', authService.isAuthenticated());

  // If not yet initialized, allow navigation but login page will show loading
  if (!authService.initialized()) {
    console.log('[GUARD] ⏳ Not initialized yet - allowing access (login will show loading)');
    return true;
  }

  // If already authenticated, redirect to dashboard
  if (authService.isAuthenticated()) {
    console.log('[GUARD] 🔄 Already authenticated - redirecting to dashboard');
    return router.createUrlTree(['/dashboard']);
  }

  // Not authenticated - allow access to login page
  console.log('[GUARD] ✅ Not authenticated - allowing access to login');
  return true;
};
