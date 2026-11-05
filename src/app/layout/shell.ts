import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith, firstValueFrom } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../core/services/auth.service';
import { NotificationCenterService } from '../core/services/notification-center.service';
import { HotkeysService } from '../core/services/hotkeys.service';
import { NotificationService } from '../core/services/notification.service';
import { NavigationUxService } from '../core/services/navigation-ux.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../shared/components/confirm-dialog/confirm-dialog';
import { RouteProgress } from './route-progress';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
}

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatMenuModule,
    RouteProgress,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell implements OnInit {
  readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly notifCenter = inject(NotificationCenterService);
  private readonly hotkeys = inject(HotkeysService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  readonly navUx = inject(NavigationUxService);

  readonly todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  readonly user = this.auth.user;
  readonly unreadCount = this.notifCenter.unreadCount;

  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly showBackTop = signal(false);
  readonly scrollProgress = signal(0);

  readonly backTopDash = computed(() => {
    const c = 2 * Math.PI * 15.5;
    const p = Math.max(0, Math.min(1, this.scrollProgress()));
    return `${(c * p).toFixed(2)} ${c.toFixed(2)}`;
  });
  readonly openGroups = signal<Record<string, boolean>>({
    master: true,
    ops: true,
    inventory: true,
    reports: false,
    settings: true,
  });

  readonly groups: NavGroup[] = [
    {
      id: 'master',
      label: 'Master Data',
      icon: 'database',
      items: [
        { label: 'Item', path: '/master/items', icon: 'inventory_2' },
        { label: 'Warehouse', path: '/master/warehouses', icon: 'warehouse' },
        { label: 'Location', path: '/master/locations', icon: 'pin_drop' },
        { label: 'Supplier', path: '/master/suppliers', icon: 'local_shipping' },
        { label: 'Customer', path: '/master/customers', icon: 'groups' },
      ],
    },
    {
      id: 'ops',
      label: 'Warehouse Operations',
      icon: 'precision_manufacturing',
      items: [
        { label: 'Inbound', path: '/operations/inbound', icon: 'move_to_inbox' },
        { label: 'Quality Inspection', path: '/operations/qi', icon: 'fact_check' },
        { label: 'Outbound', path: '/operations/outbound', icon: 'outbox' },
        { label: 'Adjustment', path: '/operations/adjustment', icon: 'tune' },
      ],
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: 'package_2',
      items: [
        { label: 'Summary', path: '/inventory/summary', icon: 'summarize' },
        { label: 'Detail', path: '/inventory/detail', icon: 'table_rows' },
        { label: 'Barcode Tracking', path: '/inventory/barcode-tracking', icon: 'qr_code_2' },
        { label: 'Warehouse Map', path: '/inventory/warehouse-map', icon: 'map' },
      ],
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: 'assessment',
      items: [
        { label: 'Transaction History', path: '/reports/transactions', icon: 'history' },
        { label: 'Inbound Report', path: '/reports/inbound', icon: 'incoming' },
        { label: 'QI Report', path: '/reports/qi', icon: 'fact_check' },
        { label: 'Outbound Report', path: '/reports/outbound', icon: 'outgoing' },
        { label: 'Adjustment Report', path: '/reports/adjustment', icon: 'compare_arrows' },
        { label: 'Inventory Report', path: '/reports/inventory', icon: 'bar_chart' },
      ],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      items: [
        { label: 'Pengaturan', path: '/settings', icon: 'tune' },
        { label: 'Preferensi', path: '/settings/preferences', icon: 'translate' },
        { label: 'Keamanan', path: '/settings/security', icon: 'lock' },
        { label: 'Demo Data', path: '/settings/demo-data', icon: 'science' },
        { label: 'Skenario', path: '/settings/scenarios', icon: 'route' },
        { label: 'Tentang', path: '/settings/about', icon: 'info' },
      ],
    },
  ];

  private readonly navEnd = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.routerState.snapshot.root),
      startWith(this.router.routerState.snapshot.root),
    ),
    { initialValue: this.router.routerState.snapshot.root },
  );

  readonly pageTitle = computed(() => {
    let node = this.navEnd();
    let title = 'KartonDock WMS';
    while (node) {
      if (node.data?.['title']) title = String(node.data['title']);
      node = node.firstChild!;
    }
    return title;
  });

  readonly breadcrumb = computed(() => {
    let node = this.navEnd();
    let crumb = 'Overview';
    while (node) {
      if (node.data?.['breadcrumb']) crumb = String(node.data['breadcrumb']);
      else if (node.data?.['title']) crumb = String(node.data['title']);
      node = node.firstChild!;
    }
    return crumb;
  });

  ngOnInit(): void {
    this.hotkeys.start();
    this.navUx.start();
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        this.closeMobile();
        this.scrollToTop(false);
      });
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const top = window.scrollY || document.documentElement.scrollTop || 0;
    const max = Math.max(
      1,
      document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );
    this.showBackTop.set(top > 240);
    this.scrollProgress.set(top / max);
  }

  scrollToTop(smooth = true): void {
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
    this.showBackTop.set(false);
    this.scrollProgress.set(0);
  }

  toggleGroup(id: string): void {
    this.openGroups.update((g) => ({ ...g, [id]: !g[id] }));
  }

  toggleSidebar(): void {
    this.collapsed.update((v) => !v);
  }

  openMobile(): void {
    this.mobileOpen.set(true);
    this.collapsed.set(false);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }

  isOpen(id: string): boolean {
    return !!this.openGroups()[id];
  }

  openShortcuts(): void {
    this.hotkeys.openHelp();
  }

  onRouteActivate(host: HTMLElement): void {
    host.classList.remove('page-view--enter');
    void host.offsetWidth;
    host.classList.add('page-view--enter');
  }

  async logout(): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          width: '420px',
          data: {
            title: 'Keluar dari KartonDock?',
            message:
              'Sesi Anda akan diakhiri dan Anda perlu masuk kembali dengan email serta kode OTP.',
            confirmText: 'Ya, keluar sekarang',
            cancelText: 'Batal',
            danger: true,
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    this.auth.logout();
    this.notify.info('Anda telah keluar.');
    void this.router.navigateByUrl('/login');
  }
}
