import { Routes } from '@angular/router';
import { authRequired, redirectIfAuthenticated } from './auth/auth.guards';
import { adminOnly } from './auth/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    loadComponent: () => import('./auth/login.page').then(m => m.LoginPage),
    canMatch: [redirectIfAuthenticated],
  },
  {
    path: 'callback',
    loadComponent: () => import('./auth/auth-callback.component').then(m => m.AuthCallbackComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/main-layout').then(m => m.MainLayout),
    canMatch: [authRequired],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES),
      },
      {
        path: 'admin',
        canMatch: [adminOnly],
        loadComponent: () => import('./features/admin/admin.page').then(m => m.AdminPage),
      },
       {
        path: 'tickets/new',
        loadComponent: () =>
          import('./features/tickets/submit-ticket.page').then(m => m.SubmitTicketPage),
      },
      {
        path: 'welcome',
        loadComponent: () => import('./pages/welcome/welcome').then(m => m.Welcome),
      },
    ],
  },
];
