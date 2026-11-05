import { Injectable, computed, signal } from '@angular/core';

export type NotifCategory = 'Inbound' | 'Outbound' | 'Adjustment' | 'Inventory' | 'System';

export interface AppNotification {
  id: string;
  category: NotifCategory;
  refCode: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

const STORAGE_KEY = 'kartondock.notifications';

@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly itemsSignal = signal<AppNotification[]>(this.loadOrSeed());

  readonly items = this.itemsSignal.asReadonly();
  readonly unreadCount = computed(() => this.itemsSignal().filter((n) => !n.read).length);

  list(filter: 'all' | 'unread' = 'all'): AppNotification[] {
    const rows = this.itemsSignal();
    return filter === 'unread' ? rows.filter((n) => !n.read) : rows;
  }

  markRead(id: string): void {
    this.itemsSignal.update((rows) =>
      rows.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    this.persist();
  }

  markAllRead(): void {
    this.itemsSignal.update((rows) => rows.map((n) => ({ ...n, read: true })));
    this.persist();
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.itemsSignal()));
  }

  private loadOrSeed(): AppNotification[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as AppNotification[];
      } catch {
        /* seed below */
      }
    }
    const now = Date.now();
    const seed: AppNotification[] = [
      {
        id: 'n1',
        category: 'Inbound',
        refCode: 'INB-20261105-0001',
        title: 'Inbound draft siap dikonfirmasi',
        message: 'Dokumen inbound menunggu generate/confirm barcode karton.',
        createdAt: new Date(now - 15 * 60_000).toISOString(),
        read: false,
        link: '/operations/inbound',
      },
      {
        id: 'n2',
        category: 'Outbound',
        refCode: 'OUT-SEED-0001',
        title: 'Outbound completed',
        message: '3 karton ITEM001 telah di-ship ke Customer A.',
        createdAt: new Date(now - 45 * 60_000).toISOString(),
        read: false,
        link: '/operations/outbound',
      },
      {
        id: 'n3',
        category: 'Inventory',
        refCode: 'INV-ALERT-001',
        title: 'Low stock alert',
        message: 'Beberapa item mendekati ambang stok rendah (≤ 3 karton).',
        createdAt: new Date(now - 2 * 3600_000).toISOString(),
        read: false,
        link: '/inventory/summary',
      },
      {
        id: 'n4',
        category: 'Adjustment',
        refCode: 'ADJ-SEED-0001',
        title: 'Adjustment selesai',
        message: '2 karton dipindahkan dari WH01-R01-B02 ke WH01-R02-B01.',
        createdAt: new Date(now - 3 * 3600_000).toISOString(),
        read: true,
        link: '/operations/adjustment',
      },
      {
        id: 'n5',
        category: 'System',
        refCode: 'SYS-DEMO',
        title: 'Mode DEMO aktif',
        message: 'Data tersimpan lokal di browser (IndexedDB). Tidak ada backend.',
        createdAt: new Date(now - 5 * 3600_000).toISOString(),
        read: false,
        link: '/settings/demo-data',
      },
      {
        id: 'n6',
        category: 'Inbound',
        refCode: 'CTN000029',
        title: 'Barcode baru tersedia',
        message: 'Karton CTN000029 & CTN000030 masuk stok Available di WH01.',
        createdAt: new Date(now - 20 * 60_000).toISOString(),
        read: false,
        link: '/inventory/barcode-tracking',
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
}
