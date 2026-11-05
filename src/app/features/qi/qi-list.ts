import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { QiDocStatus } from '../../core/enums';
import { QiHeader } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { QiService } from '../../core/services/qi.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-qi-list',
  imports: [
    PageHeader,
    StatusBadge,
    MatTableModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
  ],
  templateUrl: './qi-list.html',
  styleUrl: './qi-list.scss',
})
export class QiList implements OnInit {
  private readonly service = inject(QiService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly rows = signal<QiHeader[]>([]);
  readonly filtered = signal<QiHeader[]>([]);
  readonly statuses = Object.values(QiDocStatus);
  readonly cols = [
    'docNo',
    'inboundDocNo',
    'supplier',
    'item',
    'totalCarton',
    'inspectedCarton',
    'passedCarton',
    'failedCarton',
    'pendingCarton',
    'inspectionDate',
    'inspector',
    'status',
    'actions',
  ];

  readonly filters = this.fb.nonNullable.group({
    q: [''],
    status: [''],
    supplier: [''],
    item: [''],
    dateFrom: [''],
    dateTo: [''],
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
    this.filters.valueChanges.subscribe(() => this.applyFilter());
  }

  async reload(): Promise<void> {
    try {
      this.rows.set(await this.service.list());
      this.applyFilter();
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal memuat QI.');
    }
  }

  applyFilter(): void {
    const { q, status, supplier, item, dateFrom, dateTo } = this.filters.getRawValue();
    const term = q.trim().toLowerCase();
    const sup = supplier.trim().toLowerCase();
    const it = item.trim().toLowerCase();
    this.filtered.set(
      this.rows().filter((r) => {
        const matchQ =
          !term ||
          r.docNo.toLowerCase().includes(term) ||
          r.inboundDocNo.toLowerCase().includes(term);
        const matchStatus = !status || r.status === status;
        const matchSup =
          !sup ||
          r.supplierCode.toLowerCase().includes(sup) ||
          r.supplierName.toLowerCase().includes(sup);
        const matchItem =
          !it ||
          r.itemCodes.some((c) => c.toLowerCase().includes(it)) ||
          r.itemNames.some((n) => n.toLowerCase().includes(it));
        const d = (r.inspectionDate ?? r.createdAt).slice(0, 10);
        const matchFrom = !dateFrom || d >= dateFrom;
        const matchTo = !dateTo || d <= dateTo;
        return matchQ && matchStatus && matchSup && matchItem && matchFrom && matchTo;
      }),
    );
  }
}
