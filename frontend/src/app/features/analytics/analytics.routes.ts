import { Routes } from '@angular/router';

export const ANALYTICS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./analytics.page').then((m) => m.AnalyticsPage),
  },
];
