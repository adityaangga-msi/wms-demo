import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { InboundStatus } from '../../core/enums';
import { InboundHeader } from '../../core/models';
import { InboundStorageService } from '../../core/services/inbound-storage.service';
import { NotificationService } from '../../core/services/notification.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-inbound-report',
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
export class InboundReport implements OnInit {
  private readonly storage = inject(InboundStorageService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly title = 'Inbound Report';
  readonly subtitle = 'Riwayat dokumen inbound dengan filter status.';
  readonly rows = signal<InboundHeader[]>([]);
  readonly filtered = signal<InboundHeader[]>([]);
  readonly types = Object.values(InboundStatus);
  readonly cols = ['docNo', 'inboundDate', 'supplierName', 'warehouseCode', 'totalCarton', 'status'];

  readonly filters = this.fb.nonNullable.group({
    q: [''],
    type: [''],
  });

  async ngOnInit(): Promise<void> {
    try {
      this.rows.set(await this.storage.getAll());
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
        const matchType = !type || r.status === type;
        const matchQ =
          !term ||
          r.docNo.toLowerCase().includes(term) ||
          r.supplierName.toLowerCase().includes(term) ||
          r.warehouseCode.toLowerCase().includes(term);
        return matchType && matchQ;
      }),
    );
  }
}
