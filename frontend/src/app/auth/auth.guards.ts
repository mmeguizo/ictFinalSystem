import { inject, Injector } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { filter, map, take } from 'rxjs';
import { switchMap } from 'rxjs/operators';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function hasLocalToken(): boolean {
  if (!isBrowser()) return false;
  const token = localStorage.getItem('auth_token');
  return !!token && token.length > 0;
}

// If already authenticated and trying to access /login, redirect to /welcome
export const redirectIfAuthenticated: CanMatchFn = () => {
  if (!isBrowser()) return true; // Allow SSR render; client will handle redirect after hydration

  // Check local token first
  if (hasLocalToken()) {
    const router = inject(Router);
    return router.createUrlTree(['/dashboard']);
  }

  const injector = inject(Injector);
  const router = inject(Router);
  const auth = injector.get(AuthService, null);
  if (!auth) return true;
  return auth.isLoading$.pipe(
    filter((l) => l === false),
    take(1),
    switchMap(() => auth.isAuthenticated$),
    take(1),
    map((isAuth) => (isAuth ? router.createUrlTree(['/dashboard']) : true))
  );
};

// Require authentication for protected routes; otherwise redirect to /login
export const authRequired: CanMatchFn = () => {
  if (!isBrowser()) return true; // Allow SSR render; client will handle redirect after hydration

  // Check local token first
  if (hasLocalToken()) {
    console.log('[authRequired] Local token found, allowing access');
    return true;
  }

  const injector = inject(Injector);
  const router = inject(Router);
  const auth = injector.get(AuthService, null);
  if (!auth) {
    console.log('[authRequired] No Auth0 and no local token, redirecting to login');
    return router.createUrlTree(['/login']);
  }
  return auth.isLoading$.pipe(
    filter((l) => l === false),
    take(1),
    switchMap(() => auth.isAuthenticated$),
    take(1),
    map((isAuth) => {
      console.log('[authRequired] Auth0 authenticated:', isAuth);
      return isAuth ? true : router.createUrlTree(['/login']);
    })
  );
};

export const adminOnly = () => {
  const router = inject(Router);
  const stored = localStorage.getItem('current_user');
  if (!stored) {
    router.navigateByUrl('/login');
    return false;
  }
  try {
    const user = JSON.parse(stored);
    if (String(user.role).toUpperCase() === 'ADMIN') {
      return true;
    }
  } catch {
    // fall through
  }
  router.navigateByUrl('/dashboard');
  return false;
};
