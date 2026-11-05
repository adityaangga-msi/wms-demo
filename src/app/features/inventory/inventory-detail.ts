import { DatePipe } from '@angular/common';
import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { CartonStatus } from '../../core/enums';
import { CartonBarcode, Warehouse } from '../../core/models';
import { InventoryStorageService } from '../../core/services/inventory-storage.service';
import { NotificationService } from '../../core/services/notification.service';
import { WarehouseStorageService } from '../../core/services/warehouse-storage.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-inventory-detail',
  imports: [
    PageHeader,
    StatusBadge,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    ReactiveFormsModule,
    DatePipe,
  ],
  templateUrl: './inventory-detail.html',
  styleUrl: './inventory-detail.scss',
})
export class InventoryDetail implements OnInit {
  private readonly inventory = inject(InventoryStorageService);
  private readonly warehousesSvc = inject(WarehouseStorageService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly warehouses = signal<Warehouse[]>([]);
  readonly statuses = Object.values(CartonStatus);
  readonly dataSource = new MatTableDataSource<CartonBarcode>([]);
  readonly cols = [
    'barcode',
    'itemCode',
    'itemName',
    'warehouseCode',
    'locationCode',
    'status',
    'receivingDate',
  ];

  readonly filters = this.fb.nonNullable.group({
    barcode: [''],
    itemCode: [''],
    warehouseId: [''],
    status: ['' as CartonStatus | ''],
  });

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  async ngOnInit(): Promise<void> {
    this.warehouses.set(await this.warehousesSvc.getAll());
    await this.reload();
  }

  async reload(): Promise<void> {
    try {
      const f = this.filters.getRawValue();
      const rows = await this.inventory.getDetail({
        barcode: f.barcode || undefined,
        itemCode: f.itemCode || undefined,
        warehouseId: f.warehouseId || undefined,
        status: f.status || undefined,
      });
      this.dataSource.data = rows;
      queueMicrotask(() => (this.dataSource.paginator = this.paginator));
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal memuat detail.');
    }
  }
}
