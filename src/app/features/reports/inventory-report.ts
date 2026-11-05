import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { InventorySummaryRow } from '../../core/models';
import { InventoryStorageService } from '../../core/services/inventory-storage.service';
import { NotificationService } from '../../core/services/notification.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-inventory-report',
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
export class InventoryReport implements OnInit {
  private readonly inventory = inject(InventoryStorageService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly title = 'Inventory Report';
  readonly subtitle = 'Snapshot stok available/reserved per lokasi.';
  readonly rows = signal<InventorySummaryRow[]>([]);
  readonly filtered = signal<InventorySummaryRow[]>([]);
  readonly types: string[] | null = null;
  readonly cols = [
    'itemCode',
    'itemName',
    'warehouseCode',
    'locationCode',
    'totalCarton',
    'totalContent',
    'availableCarton',
    'availableContent',
    'reservedCarton',
  ];

  readonly filters = this.fb.nonNullable.group({
    q: [''],
    type: [''],
  });

  async ngOnInit(): Promise<void> {
    try {
      this.rows.set(await this.inventory.getSummary());
      this.applyFilter();
      this.filters.valueChanges.subscribe(() => this.applyFilter());
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal memuat laporan.');
    }
  }

  applyFilter(): void {
    const { q } = this.filters.getRawValue();
    const term = q.trim().toLowerCase();
    this.filtered.set(
      !term
        ? this.rows()
        : this.rows().filter(
            (r) =>
              r.itemCode.toLowerCase().includes(term) ||
              r.itemName.toLowerCase().includes(term) ||
              r.warehouseCode.toLowerCase().includes(term) ||
              r.locationCode.toLowerCase().includes(term),
          ),
    );
  }
}
