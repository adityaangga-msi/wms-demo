import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
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
import { PreferencesService } from '../core/services/preferences.service';
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
export class Shell implements OnInit, AfterViewInit {
  readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly notifCenter = inject(NotificationCenterService);
  private readonly hotkeys = inject(HotkeysService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  readonly navUx = inject(NavigationUxService);
  readonly prefs = inject(PreferencesService);

  private readonly navRoot = viewChild<ElementRef<HTMLElement>>('navRoot');
  private hoveringNav = false;

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
  readonly booting = signal(true);
  readonly showBackTop = signal(false);
  readonly scrollProgress = signal(0);
  readonly searchQuery = signal('');
  readonly demoFill = signal(68);
  readonly pillOn = signal(false);
  readonly pillY = signal(0);
  readonly pillH = signal(40);
  readonly pillTransform = computed(() => `translate3d(0, ${this.pillY()}px, 0)`);

  readonly tipOn = signal(false);
  readonly tipText = signal('');
  readonly tipTop = signal(0);
  readonly tipLeft = signal(0);

  private readonly iconTones: Record<string, string> = {
    dashboard: 'tone-orange',
    grid_view: 'tone-orange',
    notifications: 'tone-blue',
    inventory_2: 'tone-amber',
    warehouse: 'tone-teal',
    pin_drop: 'tone-green',
    local_shipping: 'tone-indigo',
    groups: 'tone-violet',
    move_to_inbox: 'tone-cyan',
    fact_check: 'tone-emerald',
    outbox: 'tone-orange',
    tune: 'tone-rose',
    summarize: 'tone-blue',
    table_rows: 'tone-slate',
    qr_code_2: 'tone-violet',
    map: 'tone-teal',
    history: 'tone-amber',
    incoming: 'tone-cyan',
    outgoing: 'tone-orange',
    compare_arrows: 'tone-rose',
    bar_chart: 'tone-indigo',
    translate: 'tone-blue',
    lock: 'tone-slate',
    science: 'tone-violet',
    route: 'tone-emerald',
    info: 'tone-teal',
  };

  readonly firstName = computed(() => {
    const name = this.user()?.name?.trim() || 'Operator';
    return name.split(/\s+/)[0];
  });

  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 18) return 'Selamat sore';
    return 'Selamat malam';
  });

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
    let crumb = 'Dashboard';
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
        queueMicrotask(() => this.syncPillToActive());
      });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.syncPillToActive());
    // First-load choreography (sidebar → main → page), then unlock normal motion.
    window.setTimeout(() => this.booting.set(false), 980);
  }

  iconTone(icon: string): string {
    return this.iconTones[icon] || 'tone-slate';
  }

  onNavEnter(event: Event, label?: string): void {
    const el = event.currentTarget as HTMLElement | null;
    if (!el) return;
    this.hoveringNav = true;
    this.movePillTo(el);
    this.showFloatTip(el, label || el.getAttribute('data-tooltip') || '');
  }

  onNavLeave(): void {
    this.hoveringNav = false;
    this.hideFloatTip();
    this.syncPillToActive();
  }

  private showFloatTip(el: HTMLElement, label: string): void {
    if (!this.collapsed() || !label) {
      this.hideFloatTip();
      return;
    }
    const box = el.getBoundingClientRect();
    this.tipText.set(label);
    this.tipTop.set(box.top + box.height / 2);
    this.tipLeft.set(box.right + 14);
    this.tipOn.set(true);
  }

  private hideFloatTip(): void {
    this.tipOn.set(false);
  }

  focusShellSearch(): void {
    this.openShortcuts();
  }

  private movePillTo(el: HTMLElement): void {
    const root = this.navRoot()?.nativeElement;
    if (!root) return;
    const rootBox = root.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    this.pillY.set(box.top - rootBox.top + root.scrollTop);
    this.pillH.set(box.height);
    this.pillOn.set(true);
  }

  private syncPillToActive(): void {
    if (this.hoveringNav) return;
    const root = this.navRoot()?.nativeElement;
    if (!root) return;
    const active = root.querySelector<HTMLElement>('.nav-link.active');
    if (!active) {
      this.pillOn.set(false);
      return;
    }
    active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    // Wait a frame so scroll position settles before measuring pill.
    requestAnimationFrame(() => this.movePillTo(active));
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
    queueMicrotask(() => this.syncPillToActive());
  }

  toggleSidebar(): void {
    this.hideFloatTip();
    this.collapsed.update((v) => !v);
    queueMicrotask(() => this.syncPillToActive());
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

  toggleTheme(): void {
    this.prefs.setTheme(this.prefs.theme() === 'dark' ? 'light' : 'dark');
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  runSearch(): void {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) {
      this.openShortcuts();
      return;
    }
    const routes: Array<{ keys: string[]; path: string }> = [
      { keys: ['inbound', 'in', 'masuk'], path: '/operations/inbound' },
      { keys: ['outbound', 'out', 'keluar'], path: '/operations/outbound' },
      { keys: ['qi', 'quality', 'inspeksi'], path: '/operations/qi' },
      { keys: ['adjust', 'adjustment', 'movement'], path: '/operations/adjustment' },
      { keys: ['item', 'sku', 'master'], path: '/master/items' },
      { keys: ['warehouse', 'gudang', 'wh'], path: '/master/warehouses' },
      { keys: ['inventory', 'stok', 'stock', 'summary'], path: '/inventory/summary' },
      { keys: ['barcode', 'scan', 'tracking'], path: '/inventory/barcode-tracking' },
      { keys: ['map', 'denah'], path: '/inventory/warehouse-map' },
      { keys: ['report', 'laporan', 'history', 'riwayat'], path: '/reports/transactions' },
      { keys: ['notif', 'notifikasi'], path: '/notifications' },
      { keys: ['setting', 'preferensi', 'demo'], path: '/settings' },
      { keys: ['dashboard', 'home', 'beranda', 'overview'], path: '/dashboard' },
    ];
    const hit = routes.find((r) => r.keys.some((k) => q.includes(k) || k.includes(q)));
    if (hit) {
      void this.router.navigateByUrl(hit.path);
      this.searchQuery.set('');
      return;
    }
    this.notify.info('Tidak ditemukan. Coba: inbound, outbound, inventory, reports.');
  }

  onRouteActivate(host: HTMLElement): void {
    host.classList.remove('page-view--enter');
    void host.offsetWidth;
    host.classList.add('page-view--enter');

    const page = Array.from(host.children).find((el) => {
      const tag = el.tagName;
      return tag !== 'ROUTER-OUTLET' && !tag.startsWith('NG-');
    }) as HTMLElement | undefined;
    if (!page) return;
    page.classList.remove('kd-page-enter');
    void page.offsetWidth;
    page.classList.add('kd-page-enter');
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
