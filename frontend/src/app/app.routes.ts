import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: '',
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
        path: 'inventory',
        loadComponent: () => import('./pages/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'ml-connection',
        loadComponent: () =>
          import('./pages/ml-connection/ml-connection').then((m) => m.MlConnection),
      },
      {
        path: 'ml-listings',
        loadComponent: () =>
          import('./pages/ml-listings/ml-listings').then((m) => m.MlListings),
      },
      {
        path: 'logs',
        loadComponent: () => import('./pages/logs/logs').then((m) => m.Logs),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
