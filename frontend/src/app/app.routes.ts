import { Routes } from '@angular/router';
import { authRequired, redirectIfAuthenticated } from './auth/auth.guards';

export const routes: Routes = [
  // default root -> login
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  // Top-level login route: renders standalone page without the main layout (no sidebar)
  {
    path: 'login',
    loadComponent: () => import('./auth/login.page').then((m) => m.LoginPage),
    canMatch: [redirectIfAuthenticated],
  },
  // Auth0 callback route: process redirect and continue
  {
    path: 'callback',
    loadComponent: () => import('./auth').then(m => m.AuthCallbackComponent),
  },
  // All other app pages live under the main layout shell
  {
    path: '',
    loadComponent: () => import('./layout/main-layout').then(m => m.MainLayout),
    canMatch: [authRequired],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'welcome' },
      { path: 'welcome', loadChildren: () => import('./pages/welcome/welcome.routes').then(m => m.WELCOME_ROUTES) },
      // add other feature routes here as children so they render inside the layout
    ]
  },
];
