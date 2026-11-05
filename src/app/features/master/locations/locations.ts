import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { LocationBin } from '../../../core/models';
import { LocationStorageService } from '../../../core/services/location-storage.service';
import { NotificationService } from '../../../core/services/notification.service';
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
import { LocationFormDialog } from './location-form-dialog';

@Component({
  selector: 'app-locations',
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
  templateUrl: './locations.html',
  styleUrl: './locations.scss',
})
export class Locations implements OnInit {
  private readonly storage = inject(LocationStorageService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly rows = signal<LocationBin[]>([]);
  readonly filtered = signal<LocationBin[]>([]);
  readonly search = signal('');
  readonly cols = [
    'locationCode',
    'locationName',
    'warehouseCode',
    'floorCode',
    'locationType',
    'capacity',
    'status',
    'actions',
  ];

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
              r.locationCode.toLowerCase().includes(q) ||
              r.locationName.toLowerCase().includes(q) ||
              r.warehouseCode.toLowerCase().includes(q) ||
              (r.floorCode || '').toLowerCase().includes(q),
          ),
    );
  }

  openCreate(): void {
    this.dialog
      .open(LocationFormDialog, { width: '520px', data: null })
      .afterClosed()
      .subscribe(async (ok) => {
        if (ok) await this.reload();
      });
  }

  openEdit(row: LocationBin, ev?: Event): void {
    ev?.stopPropagation();
    this.dialog
      .open(LocationFormDialog, { width: '520px', data: row })
      .afterClosed()
      .subscribe(async (ok) => {
        if (ok) await this.reload();
      });
  }

  openStock(row: LocationBin, ev?: Event): void {
    ev?.stopPropagation();
    this.dialog.open<StockBrowseDialog, StockBrowseDialogData>(StockBrowseDialog, {
      width: '720px',
      data: {
        title: `Stok · ${row.locationCode}`,
        subtitle: `${row.locationName} · ${row.warehouseCode}${row.floorCode ? ' / ' + row.floorCode : ''}`,
        locationId: row.id,
        mapQuery: {
          wh: row.warehouseId,
          floor: row.floorId,
          loc: row.id,
        },
      },
    });
  }

  openMap(row: LocationBin, ev?: Event): void {
    ev?.stopPropagation();
    void this.router.navigate(['/inventory/warehouse-map'], {
      queryParams: { wh: row.warehouseId, floor: row.floorId, loc: row.id },
    });
  }

  async remove(row: LocationBin, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          data: {
            title: 'Hapus Location',
            message: `Hapus location ${row.locationCode}?`,
            confirmText: 'Hapus',
            danger: true,
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    try {
      await this.storage.remove(row.id);
      this.notify.success('Location dihapus.');
      await this.reload();
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menghapus.');
    }
  }
}
