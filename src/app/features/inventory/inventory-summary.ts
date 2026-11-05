import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { InventorySummaryRow, Warehouse } from '../../core/models';
import { InventoryStorageService } from '../../core/services/inventory-storage.service';
import { NotificationService } from '../../core/services/notification.service';
import { WarehouseStorageService } from '../../core/services/warehouse-storage.service';
import { PageHeader } from '../../shared/components/page-header/page-header';

@Component({
  selector: 'app-inventory-summary',
  imports: [
    PageHeader,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './inventory-summary.html',
  styleUrl: './inventory-summary.scss',
})
export class InventorySummary implements OnInit {
  private readonly inventory = inject(InventoryStorageService);
  private readonly warehousesSvc = inject(WarehouseStorageService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly warehouses = signal<Warehouse[]>([]);
  readonly dataSource = new MatTableDataSource<InventorySummaryRow>([]);
  readonly cols = [
    'itemCode',
    'itemName',
    'category',
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
    warehouseId: [''],
  });

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  async ngOnInit(): Promise<void> {
    this.warehouses.set(await this.warehousesSvc.getAll());
    await this.reload();
    this.filters.valueChanges.subscribe(() => this.applyFilter());
  }

  async reload(): Promise<void> {
    try {
      const rows = await this.inventory.getSummary();
      this.dataSource.data = rows;
      queueMicrotask(() => {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
      });
      this.applyFilter();
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal memuat summary.');
    }
  }

  applyFilter(): void {
    const { q, warehouseId } = this.filters.getRawValue();
    const term = q.trim().toLowerCase();
    this.dataSource.filterPredicate = (row, filter) => {
      const f = JSON.parse(filter) as { term: string; warehouseId: string };
      const matchWh = !f.warehouseId || row.warehouseId === f.warehouseId;
      const matchQ =
        !f.term ||
        row.itemCode.toLowerCase().includes(f.term) ||
        row.itemName.toLowerCase().includes(f.term) ||
        (row.category ?? '').toLowerCase().includes(f.term) ||
        row.locationCode.toLowerCase().includes(f.term);
      return matchWh && matchQ;
    };
    this.dataSource.filter = JSON.stringify({ term, warehouseId });
  }
}
