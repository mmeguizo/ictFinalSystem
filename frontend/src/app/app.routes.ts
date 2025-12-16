import { Routes } from '@angular/router';
import { authGuard, adminGuard, guestGuard, approverGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    loadComponent: () => import('./auth/login.page').then(m => m.LoginPage),
    canActivate: [guestGuard], // Redirects authenticated users to dashboard
  },
  {
    path: 'callback',
    loadComponent: () => import('./auth/auth-callback.component').then(m => m.AuthCallbackComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/main-layout').then(m => m.MainLayout),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/admin.page').then(m => m.AdminPage),
      },
      {
        path: 'tickets',
        loadComponent: () =>
          import('./features/tickets/tickets-layout.component').then(m => m.TicketsLayoutComponent),
        children: [
          {
            path: 'approvals',
            loadComponent: () =>
              import('./features/approvals/secretary-approval.page').then(m => m.SecretaryApprovalPage),
            canActivate: [approverGuard],
          },
          {
            path: '',
            loadComponent: () =>
              import('./features/tickets/my-tickets.page').then(m => m.MyTicketsPage),
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./features/tickets/submit-ticket.page').then(m => m.SubmitTicketPage),
          },
          {
            path: ':ticketNumber',
            loadComponent: () =>
              import('./features/tickets/ticket-detail.page').then(m => m.TicketDetailPage),
          },
        ],
      },
      {
        path: 'welcome',
        loadComponent: () => import('./pages/welcome/welcome').then(m => m.Welcome),
      },
    ],
  },
];
