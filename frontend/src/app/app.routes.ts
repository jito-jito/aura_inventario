import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'products',
        loadComponent: () => import('./pages/products/products').then((m) => m.Products),
      },
      {
        path: 'ml-integration',
        loadComponent: () =>
          import('./pages/ml-integration/ml-integration').then((m) => m.MlIntegration),
      },
      {
        path: 'ml-integration/unlinked-products',
        loadComponent: () =>
          import('./pages/ml-integration/unlinked-products/unlinked-products').then(
            (m) => m.MlIntegrationUnlinkedProducts,
          ),
      },
      {
        path: 'ml-integration/unlinked-publications',
        loadComponent: () =>
          import('./pages/ml-integration/unlinked-publications/unlinked-publications').then(
            (m) => m.MlIntegrationUnlinkedPublications,
          ),
      },
      {
        path: 'ml-integration/linked',
        loadComponent: () =>
          import('./pages/ml-integration/linked/linked').then((m) => m.MlIntegrationLinked),
      },
      {
        path: 'logs',
        loadComponent: () => import('./pages/logs/logs').then((m) => m.Logs),
      },
      {
        path: 'backups',
        loadComponent: () => import('./pages/backups/backups').then((m) => m.Backups),
      },
      {
        path: 'projections',
        loadComponent: () => import('./pages/projections/projections').then((m) => m.Projections),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
