import { Routes } from '@angular/router';
import { Shell } from './layout/shell';
import { authGuard, guestGuard, otpGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'otp',
    canActivate: [otpGuard],
    loadComponent: () => import('./features/auth/otp/otp').then((m) => m.Otp),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
        data: { title: 'Dashboard / Overview', breadcrumb: 'Dashboard' },
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications').then((m) => m.Notifications),
        data: { title: 'Notifikasi', breadcrumb: 'Notifikasi' },
      },
      {
        path: 'master/items',
        loadComponent: () => import('./features/master/items/items').then((m) => m.Items),
        data: { title: 'Master Item', breadcrumb: 'Master / Item' },
      },
      {
        path: 'master/warehouses',
        loadComponent: () =>
          import('./features/master/warehouses/warehouses').then((m) => m.Warehouses),
        data: { title: 'Master Warehouse', breadcrumb: 'Master / Warehouse' },
      },
      {
        path: 'master/locations',
        loadComponent: () =>
          import('./features/master/locations/locations').then((m) => m.Locations),
        data: { title: 'Master Location', breadcrumb: 'Master / Location' },
      },
      {
        path: 'master/suppliers',
        loadComponent: () =>
          import('./features/master/suppliers/suppliers').then((m) => m.Suppliers),
        data: { title: 'Master Supplier', breadcrumb: 'Master / Supplier' },
      },
      {
        path: 'master/customers',
        loadComponent: () =>
          import('./features/master/customers/customers').then((m) => m.Customers),
        data: { title: 'Master Customer', breadcrumb: 'Master / Customer' },
      },
      {
        path: 'operations/inbound',
        loadComponent: () =>
          import('./features/inbound/inbound-list').then((m) => m.InboundList),
        data: { title: 'Inbound', breadcrumb: 'Operations / Inbound' },
      },
      {
        path: 'operations/inbound/:id',
        loadComponent: () =>
          import('./features/inbound/inbound-detail').then((m) => m.InboundDetail),
        data: { title: 'Inbound Detail', breadcrumb: 'Operations / Inbound' },
      },
      {
        path: 'operations/qi',
        loadComponent: () => import('./features/qi/qi-list').then((m) => m.QiList),
        data: { title: 'Quality Inspection', breadcrumb: 'Operations / Quality Inspection' },
      },
      {
        path: 'operations/qi/:id',
        loadComponent: () => import('./features/qi/qi-detail').then((m) => m.QiDetailPage),
        data: { title: 'QI Detail', breadcrumb: 'Operations / Quality Inspection' },
      },
      {
        path: 'operations/outbound',
        loadComponent: () =>
          import('./features/outbound/outbound-list').then((m) => m.OutboundList),
        data: { title: 'Outbound', breadcrumb: 'Operations / Outbound' },
      },
      {
        path: 'operations/outbound/:id',
        loadComponent: () =>
          import('./features/outbound/outbound-detail').then((m) => m.OutboundDetail),
        data: { title: 'Outbound Detail', breadcrumb: 'Operations / Outbound' },
      },
      {
        path: 'operations/adjustment',
        loadComponent: () =>
          import('./features/movement/movement-list').then((m) => m.MovementList),
        data: { title: 'Adjustment', breadcrumb: 'Operations / Adjustment' },
      },
      {
        path: 'operations/adjustment/:id',
        loadComponent: () =>
          import('./features/movement/movement-detail').then((m) => m.MovementDetail),
        data: { title: 'Adjustment Detail', breadcrumb: 'Operations / Adjustment' },
      },
      { path: 'operations/movement', redirectTo: 'operations/adjustment', pathMatch: 'full' },
      { path: 'operations/movement/:id', redirectTo: 'operations/adjustment/:id' },
      {
        path: 'inventory/summary',
        loadComponent: () =>
          import('./features/inventory/inventory-summary').then((m) => m.InventorySummary),
        data: { title: 'Inventory Summary', breadcrumb: 'Inventory / Summary' },
      },
      {
        path: 'inventory/detail',
        loadComponent: () =>
          import('./features/inventory/inventory-detail').then((m) => m.InventoryDetail),
        data: { title: 'Inventory Detail', breadcrumb: 'Inventory / Detail' },
      },
      {
        path: 'inventory/barcode-tracking',
        loadComponent: () =>
          import('./features/inventory/barcode-tracking').then((m) => m.BarcodeTracking),
        data: { title: 'Barcode Tracking', breadcrumb: 'Inventory / Barcode Tracking' },
      },
      {
        path: 'inventory/warehouse-map',
        loadComponent: () =>
          import('./features/inventory/warehouse-map').then((m) => m.WarehouseMap),
        data: { title: 'Warehouse Map', breadcrumb: 'Inventory / Warehouse Map' },
      },
      {
        path: 'reports/transactions',
        loadComponent: () =>
          import('./features/reports/transaction-history').then((m) => m.TransactionHistory),
        data: { title: 'Transaction History', breadcrumb: 'Reports / Transactions' },
      },
      {
        path: 'reports/inbound',
        loadComponent: () =>
          import('./features/reports/inbound-report').then((m) => m.InboundReport),
        data: { title: 'Inbound Report', breadcrumb: 'Reports / Inbound' },
      },
      {
        path: 'reports/qi',
        loadComponent: () => import('./features/reports/qi-report').then((m) => m.QiReport),
        data: { title: 'QI Report', breadcrumb: 'Reports / Quality Inspection' },
      },
      {
        path: 'reports/outbound',
        loadComponent: () =>
          import('./features/reports/outbound-report').then((m) => m.OutboundReport),
        data: { title: 'Outbound Report', breadcrumb: 'Reports / Outbound' },
      },
      {
        path: 'reports/adjustment',
        loadComponent: () =>
          import('./features/reports/movement-report').then((m) => m.MovementReport),
        data: { title: 'Adjustment Report', breadcrumb: 'Reports / Adjustment' },
      },
      { path: 'reports/movement', redirectTo: 'reports/adjustment', pathMatch: 'full' },
      {
        path: 'reports/inventory',
        loadComponent: () =>
          import('./features/reports/inventory-report').then((m) => m.InventoryReport),
        data: { title: 'Inventory Report', breadcrumb: 'Reports / Inventory' },
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings-hub').then((m) => m.SettingsHub),
        data: { title: 'Pengaturan', breadcrumb: 'Pengaturan' },
      },
      {
        path: 'settings/preferences',
        loadComponent: () => import('./features/settings/preferences').then((m) => m.PreferencesPage),
        data: { title: 'Preferensi', breadcrumb: 'Pengaturan / Preferensi' },
      },
      {
        path: 'settings/security',
        loadComponent: () => import('./features/settings/security').then((m) => m.SecurityPage),
        data: { title: 'Keamanan', breadcrumb: 'Pengaturan / Keamanan' },
      },
      {
        path: 'settings/demo-data',
        loadComponent: () => import('./features/settings/demo-data').then((m) => m.DemoData),
        data: { title: 'Demo Data Management', breadcrumb: 'Pengaturan / Demo Data' },
      },
      {
        path: 'settings/about',
        loadComponent: () => import('./features/settings/about').then((m) => m.AboutPage),
        data: { title: 'Tentang Aplikasi', breadcrumb: 'Pengaturan / Tentang' },
      },
      {
        path: 'settings/scenarios',
        loadComponent: () => import('./features/settings/scenarios').then((m) => m.ScenariosPage),
        data: { title: 'Skenario Transaksi', breadcrumb: 'Pengaturan / Skenario' },
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
