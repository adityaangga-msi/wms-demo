import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { Warehouse } from '../../../core/models';
import { NotificationService } from '../../../core/services/notification.service';
import { WarehouseStorageService } from '../../../core/services/warehouse-storage.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import {
  StockBrowseDialog,
  StockBrowseDialogData,
} from '../../../shared/components/stock-browse-dialog/stock-browse-dialog';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { WarehouseFormDialog } from './warehouse-form-dialog';

@Component({
  selector: 'app-warehouses',
  imports: [
    PageHeader,
    StatusBadge,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
  ],
  templateUrl: './warehouses.html',
  styleUrl: './warehouses.scss',
})
export class Warehouses implements OnInit {
  private readonly storage = inject(WarehouseStorageService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly rows = signal<Warehouse[]>([]);
  readonly filtered = signal<Warehouse[]>([]);
  readonly search = signal('');
  readonly cols = ['warehouseCode', 'warehouseName', 'address', 'status', 'actions'];

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.rows.set(await this.storage.getAll());
    this.applyFilter();
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.applyFilter();
  }

  applyFilter(): void {
    const q = this.search().trim().toLowerCase();
    this.filtered.set(
      !q
        ? this.rows()
        : this.rows().filter(
            (r) =>
              r.warehouseCode.toLowerCase().includes(q) ||
              r.warehouseName.toLowerCase().includes(q) ||
              r.address.toLowerCase().includes(q),
          ),
    );
  }

  openCreate(): void {
    this.dialog
      .open(WarehouseFormDialog, { width: '480px', data: null })
      .afterClosed()
      .subscribe(async (ok) => {
        if (ok) await this.reload();
      });
  }

  openEdit(row: Warehouse, ev?: Event): void {
    ev?.stopPropagation();
    this.dialog
      .open(WarehouseFormDialog, { width: '480px', data: row })
      .afterClosed()
      .subscribe(async (ok) => {
        if (ok) await this.reload();
      });
  }

  openStock(row: Warehouse, ev?: Event): void {
    ev?.stopPropagation();
    this.dialog.open<StockBrowseDialog, StockBrowseDialogData>(StockBrowseDialog, {
      width: '720px',
      data: {
        title: `Stok · ${row.warehouseCode}`,
        subtitle: row.warehouseName,
        warehouseId: row.id,
        mapQuery: { wh: row.id },
      },
    });
  }

  openMap(row: Warehouse, ev?: Event): void {
    ev?.stopPropagation();
    void this.router.navigate(['/inventory/warehouse-map'], {
      queryParams: { wh: row.id },
    });
  }

  async remove(row: Warehouse, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          data: {
            title: 'Hapus Warehouse',
            message: `Hapus warehouse ${row.warehouseCode}?`,
            confirmText: 'Hapus',
            danger: true,
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    try {
      await this.storage.remove(row.id);
      this.notify.success('Warehouse dihapus.');
      await this.reload();
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menghapus.');
    }
  }
}
