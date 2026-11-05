import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { TransactionType } from '../../core/enums';
import { TransactionHistoryRow } from '../../core/models';
import { InboundStorageService } from '../../core/services/inbound-storage.service';
import { MovementStorageService } from '../../core/services/movement-storage.service';
import { NotificationService } from '../../core/services/notification.service';
import { OutboundStorageService } from '../../core/services/outbound-storage.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-transaction-history',
  imports: [
    PageHeader,
    StatusBadge,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    DatePipe,
  ],
  templateUrl: './report-table.html',
  styleUrl: './reports.scss',
})
export class TransactionHistory implements OnInit {
  private readonly inbounds = inject(InboundStorageService);
  private readonly outbounds = inject(OutboundStorageService);
  private readonly movements = inject(MovementStorageService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly title = 'Transaction History';
  readonly subtitle = 'Gabungan inbound, outbound, dan adjustment.';
  readonly rows = signal<TransactionHistoryRow[]>([]);
  readonly filtered = signal<TransactionHistoryRow[]>([]);
  readonly types = Object.values(TransactionType);
  readonly cols = ['docNo', 'transactionDate', 'transactionType', 'warehouseCode', 'partyName', 'totalCarton', 'status'];

  readonly filters = this.fb.nonNullable.group({
    q: [''],
    type: [''],
  });

  async ngOnInit(): Promise<void> {
    try {
      const [inb, out, mov] = await Promise.all([
        this.inbounds.getAll(),
        this.outbounds.getAll(),
        this.movements.getAll(),
      ]);
      const rows: TransactionHistoryRow[] = [
        ...inb.map((d) => ({
          id: d.id,
          docNo: d.docNo,
          transactionDate: d.confirmedAt ?? d.createdAt,
          transactionType: TransactionType.Inbound,
          warehouseCode: d.warehouseCode,
          totalCarton: d.totalCarton,
          status: d.status,
          createdBy: d.createdBy,
          partyName: d.supplierName,
        })),
        ...out.map((d) => ({
          id: d.id,
          docNo: d.docNo,
          transactionDate: d.confirmedAt ?? d.createdAt,
          transactionType: TransactionType.Outbound,
          warehouseCode: d.warehouseCode,
          totalCarton: d.totalCarton,
          status: d.status,
          createdBy: d.createdBy,
          partyName: d.customerName,
        })),
        ...mov.map((d) => ({
          id: d.id,
          docNo: d.docNo,
          transactionDate: d.confirmedAt ?? d.createdAt,
          transactionType: TransactionType.Adjustment,
          warehouseCode: `${d.fromWarehouseCode}→${d.toWarehouseCode}`,
          totalCarton: d.totalCarton,
          status: d.status,
          createdBy: d.createdBy,
          partyName: `${d.fromLocationCode}→${d.toLocationCode}`,
        })),
      ].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
      this.rows.set(rows);
      this.applyFilter();
      this.filters.valueChanges.subscribe(() => this.applyFilter());
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal memuat laporan.');
    }
  }

  applyFilter(): void {
    const { q, type } = this.filters.getRawValue();
    const term = q.trim().toLowerCase();
    this.filtered.set(
      this.rows().filter((r) => {
        const matchType = !type || r.transactionType === type;
        const matchQ =
          !term ||
          r.docNo.toLowerCase().includes(term) ||
          (r.partyName ?? '').toLowerCase().includes(term) ||
          r.warehouseCode.toLowerCase().includes(term);
        return matchType && matchQ;
      }),
    );
  }
}
