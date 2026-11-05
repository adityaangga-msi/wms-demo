import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { CartonStatus } from '../../../core/enums';
import { CartonBarcode } from '../../../core/models';
import { BarcodeStorageService } from '../../../core/services/barcode-storage.service';
import { StatusBadge } from '../status-badge/status-badge';

export interface StockBrowseDialogData {
  title: string;
  subtitle?: string;
  warehouseId?: string;
  locationId?: string;
  /** Deep-link ke denah 3D */
  mapQuery?: { wh?: string; floor?: string; loc?: string };
}

@Component({
  selector: 'app-stock-browse-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    StatusBadge,
    RouterLink,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      @if (data.subtitle) {
        <p class="sub">{{ data.subtitle }}</p>
      }
      <p class="meta">{{ cartons().length }} karton · {{ itemSummary() }}</p>
      <div class="table-wrap">
        <table mat-table [dataSource]="cartons()" class="wms-table">
          <ng-container matColumnDef="barcode">
            <th mat-header-cell *matHeaderCellDef>Barcode</th>
            <td mat-cell *matCellDef="let row" class="mono">
              <a [routerLink]="['/inventory/barcode-tracking']" [queryParams]="{ b: row.barcode }" (click)="ref.close()">
                {{ row.barcode }}
              </a>
            </td>
          </ng-container>
          <ng-container matColumnDef="item">
            <th mat-header-cell *matHeaderCellDef>Item</th>
            <td mat-cell *matCellDef="let row">
              <span class="mono">{{ row.itemCode }}</span>
              <div class="muted">{{ row.itemName }}</div>
            </td>
          </ng-container>
          <ng-container matColumnDef="loc">
            <th mat-header-cell *matHeaderCellDef>Lokasi</th>
            <td mat-cell *matCellDef="let row" class="mono">{{ row.locationCode }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let row">
              <app-status-badge [status]="row.status" />
              <app-status-badge [status]="row.inventoryStatus || 'UU'" />
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
      </div>
      @if (!cartons().length) {
        <p class="empty">Tidak ada stok di scope ini.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (data.mapQuery; as q) {
        <a
          mat-stroked-button
          [routerLink]="['/inventory/warehouse-map']"
          [queryParams]="q"
          (click)="ref.close()"
        >
          <mat-icon>map</mat-icon>
          Buka di Map
        </a>
      }
      <button mat-button type="button" mat-dialog-close>Tutup</button>
    </mat-dialog-actions>
  `,
  styles: `
    .sub {
      margin: 0 0 0.35rem;
      color: #5a6b82;
      font-size: 0.9rem;
    }
    .meta {
      margin: 0 0 0.75rem;
      font-size: 0.85rem;
      color: #334155;
    }
    .muted {
      font-size: 0.8rem;
      color: #64748b;
    }
    .empty {
      color: #64748b;
      margin: 0.75rem 0 0;
    }
    .table-wrap {
      max-height: min(52vh, 420px);
      overflow: auto;
    }
    a.mono {
      color: inherit;
    }
  `,
})
export class StockBrowseDialog implements OnInit {
  readonly data = inject<StockBrowseDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<StockBrowseDialog>);
  private readonly barcodes = inject(BarcodeStorageService);

  readonly cartons = signal<CartonBarcode[]>([]);
  readonly cols = ['barcode', 'item', 'loc', 'status'];

  async ngOnInit(): Promise<void> {
    let rows: CartonBarcode[] = [];
    if (this.data.locationId) {
      rows = await this.barcodes.getByLocation(this.data.locationId);
    } else if (this.data.warehouseId) {
      rows = await this.barcodes.getByWarehouse(this.data.warehouseId);
    }
    this.cartons.set(
      rows.filter((c) => c.status !== CartonStatus.Shipped && c.status !== CartonStatus.Inactive),
    );
  }

  itemSummary(): string {
    const map = new Map<string, number>();
    for (const c of this.cartons()) {
      map.set(c.itemCode, (map.get(c.itemCode) ?? 0) + 1);
    }
    if (!map.size) return '0 item';
    return [...map.entries()]
      .slice(0, 4)
      .map(([code, n]) => `${code}×${n}`)
      .join(', ') + (map.size > 4 ? ` (+${map.size - 4})` : '');
  }
}
