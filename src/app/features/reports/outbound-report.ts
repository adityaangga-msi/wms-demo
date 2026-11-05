import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { OutboundStatus } from '../../core/enums';
import { OutboundHeader } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { OutboundStorageService } from '../../core/services/outbound-storage.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-outbound-report',
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
export class OutboundReport implements OnInit {
  private readonly storage = inject(OutboundStorageService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly title = 'Outbound Report';
  readonly subtitle = 'Riwayat dokumen outbound dengan filter status.';
  readonly rows = signal<OutboundHeader[]>([]);
  readonly filtered = signal<OutboundHeader[]>([]);
  readonly types = Object.values(OutboundStatus);
  readonly cols = ['docNo', 'outboundDate', 'customerName', 'warehouseCode', 'totalCarton', 'status'];

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
          r.customerName.toLowerCase().includes(term) ||
          r.warehouseCode.toLowerCase().includes(term);
        return matchType && matchQ;
      }),
    );
  }
}
