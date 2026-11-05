import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { TransactionType } from '../../core/enums';
import { CartonBarcode, InventoryTransaction, QiEvidence } from '../../core/models';
import { BarcodeService } from '../../core/services/barcode.service';
import { InventoryTransactionService } from '../../core/services/inventory-transaction.service';
import { LocationStorageService } from '../../core/services/location-storage.service';
import { NotificationService } from '../../core/services/notification.service';
import { QiService } from '../../core/services/qi.service';
import { BarcodeLabel } from '../../shared/components/barcode-label/barcode-label';
import { BarcodeScanner } from '../../shared/components/barcode-scanner/barcode-scanner';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

export type TimelineStageKey = 'Inbound' | 'QI' | 'Adjustment' | 'Outbound';

export interface TimelineEvent {
  id: string;
  when: string;
  dayKey: string;
  dayLabel: string;
  timeLabel: string;
  stage: TimelineStageKey;
  title: string;
  who: string;
  qty: number;
  where: string;
  docNo: string;
  notes: string;
  status: string;
  icon: string;
  side: 'left' | 'right';
}

export interface ChatDayGroup {
  dayKey: string;
  dayLabel: string;
  items: TimelineEvent[];
}

@Component({
  selector: 'app-barcode-tracking',
  imports: [
    PageHeader,
    StatusBadge,
    BarcodeScanner,
    BarcodeLabel,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    DatePipe,
    RouterLink,
  ],
  templateUrl: './barcode-tracking.html',
  styleUrl: './barcode-tracking.scss',
})
export class BarcodeTracking implements OnInit {
  private readonly barcodes = inject(BarcodeService);
  private readonly txn = inject(InventoryTransactionService);
  private readonly locs = inject(LocationStorageService);
  private readonly qi = inject(QiService);
  private readonly notify = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);

  readonly carton = signal<CartonBarcode | null>(null);
  readonly notFound = signal(false);
  readonly history = signal<InventoryTransaction[]>([]);
  readonly events = signal<TimelineEvent[]>([]);
  readonly chatDays = signal<ChatDayGroup[]>([]);
  readonly inboundAt = signal<string | null>(null);
  readonly qiAt = signal<string | null>(null);
  readonly adjustAt = signal<string | null>(null);
  readonly outboundAt = signal<string | null>(null);
  readonly dwellLabel = signal('');
  readonly photos = signal<{ id: string; url: string; fileName: string }[]>([]);
  readonly histCols = ['date', 'type', 'ref', 'who', 'qty', 'where', 'status', 'notes'];

  private readonly locCodeById = new Map<string, string>();

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((q) => {
      const b = q.get('b');
      if (b) void this.onScan(b);
    });
  }

  async onScan(code: string): Promise<void> {
    try {
      for (const p of this.photos()) URL.revokeObjectURL(p.url);
      const row = await this.barcodes.getCarton(code);
      this.carton.set(row ?? null);
      this.notFound.set(!row);
      if (!row) {
        this.resetTimeline();
        this.photos.set([]);
        this.notify.error(`Barcode ${code} tidak ditemukan.`);
        return;
      }
      const hist = await this.txn.byBarcode(row.barcode);
      await this.warmLocationLabels(hist, row);
      this.history.set(hist);
      this.buildChatTimeline(hist);
      if (row.qiHeaderId) {
        const all = await this.qi.listEvidenceForHeader(row.qiHeaderId);
        const mine = all.filter((e) => e.barcode === row.barcode);
        this.photos.set(
          mine.map((ev: QiEvidence) => ({
            id: ev.id,
            fileName: ev.fileName,
            url: URL.createObjectURL(new Blob([ev.blobData], { type: ev.mimeType })),
          })),
        );
      } else {
        this.photos.set([]);
      }
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal lookup barcode.');
    }
  }

  whereLabel(row: InventoryTransaction): string {
    const from = row.fromLocationId
      ? this.locCodeById.get(row.fromLocationId) || '…'
      : '—';
    const to = row.toLocationId ? this.locCodeById.get(row.toLocationId) || '…' : '—';
    if (from === '—' && to === '—') return '—';
    if (from === to) return from;
    return `${from} → ${to}`;
  }

  stageClass(stage: TimelineStageKey): string {
    return (
      {
        Inbound: 'in',
        QI: 'qi',
        Adjustment: 'adj',
        Outbound: 'out',
      } as const
    )[stage];
  }

  private resetTimeline(): void {
    this.history.set([]);
    this.events.set([]);
    this.chatDays.set([]);
    this.inboundAt.set(null);
    this.qiAt.set(null);
    this.adjustAt.set(null);
    this.outboundAt.set(null);
    this.dwellLabel.set('');
  }

  private buildChatTimeline(hist: InventoryTransaction[]): void {
    const chrono = [...hist].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime(),
    );

    const events: TimelineEvent[] = chrono.map((row) => {
      const stage = this.mapStage(row.transactionType);
      const when = row.transactionDate;
      const d = new Date(when);
      return {
        id: row.id,
        when,
        dayKey: this.dayKey(d),
        dayLabel: this.fmtDay(d),
        timeLabel: this.fmtTime(d),
        stage,
        title: this.stageTitle(stage),
        who: row.createdBy || '—',
        qty: row.quantity ?? 1,
        where: this.whereLabel(row),
        docNo: row.referenceDocNo,
        notes: row.notes || '—',
        status: `${row.previousStatus || row.previousCartonStatus || '—'} → ${row.newStatus || row.newCartonStatus || '—'}`,
        icon: this.stageIcon(stage),
        side: stage === 'Outbound' ? 'right' : 'left',
      };
    });
    this.events.set(events);

    const groups = new Map<string, ChatDayGroup>();
    for (const e of events) {
      let g = groups.get(e.dayKey);
      if (!g) {
        g = { dayKey: e.dayKey, dayLabel: e.dayLabel, items: [] };
        groups.set(e.dayKey, g);
      }
      g.items.push(e);
    }
    this.chatDays.set([...groups.values()]);

    const first = (s: TimelineStageKey) => events.find((e) => e.stage === s)?.when ?? null;
    this.inboundAt.set(first('Inbound'));
    this.qiAt.set(first('QI'));
    this.adjustAt.set(first('Adjustment'));
    this.outboundAt.set(first('Outbound'));

    const masuk = events[0]?.when;
    const keluar = first('Outbound') ?? events.at(-1)?.when;
    this.dwellLabel.set(this.formatDwell(masuk, keluar, !!first('Outbound')));
  }

  private mapStage(type: string): TimelineStageKey {
    if (type === TransactionType.Inbound || type === 'Inbound') return 'Inbound';
    if (type === TransactionType.QualityInspection || type === 'Quality Inspection') return 'QI';
    if (type === TransactionType.Outbound || type === 'Outbound') return 'Outbound';
    return 'Adjustment';
  }

  private stageTitle(stage: TimelineStageKey): string {
    return (
      {
        Inbound: 'Masuk gudang (Inbound)',
        QI: 'Quality Inspection',
        Adjustment: 'Adjustment',
        Outbound: 'Keluar gudang (Outbound)',
      } as const
    )[stage];
  }

  private stageIcon(stage: TimelineStageKey): string {
    return (
      {
        Inbound: 'login',
        QI: 'fact_check',
        Adjustment: 'swap_horiz',
        Outbound: 'logout',
      } as const
    )[stage];
  }

  private dayKey(d: Date): string {
    if (Number.isNaN(d.getTime())) return 'unknown';
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  private fmtDay(d: Date): string {
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private fmtTime(d: Date): string {
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  private fmtLong(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatDwell(from?: string | null, to?: string | null, exited = false): string {
    if (!from || !to) return '';
    const ms = new Date(to).getTime() - new Date(from).getTime();
    if (ms < 0) return '';
    const mins = Math.floor(ms / 60000);
    const days = Math.floor(mins / (60 * 24));
    const hours = Math.floor((mins % (60 * 24)) / 60);
    const m = mins % 60;
    const span = [
      days ? `${days} hari` : '',
      hours ? `${hours} jam` : '',
      !days ? `${m} mnt` : '',
    ]
      .filter(Boolean)
      .join(' ');
    return exited
      ? `Di gudang ${span} · masuk ${this.fmtLong(from)} · keluar ${this.fmtLong(to)}`
      : `Sudah ${span} sejak masuk ${this.fmtLong(from)} (belum outbound)`;
  }

  private async warmLocationLabels(
    hist: InventoryTransaction[],
    carton: CartonBarcode,
  ): Promise<void> {
    this.locCodeById.clear();
    if (carton.locationId && carton.locationCode) {
      this.locCodeById.set(carton.locationId, carton.locationCode);
    }
    const ids = new Set<string>();
    for (const h of hist) {
      if (h.fromLocationId) ids.add(h.fromLocationId);
      if (h.toLocationId) ids.add(h.toLocationId);
    }
    await Promise.all(
      [...ids].map(async (id) => {
        if (this.locCodeById.has(id)) return;
        const loc = await this.locs.getById(id);
        if (loc) this.locCodeById.set(id, loc.locationCode);
      }),
    );
  }
}
