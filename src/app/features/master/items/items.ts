import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { Item } from '../../../core/models';
import { ItemStorageService } from '../../../core/services/item-storage.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { ItemFormDialog } from './item-form-dialog';

@Component({
  selector: 'app-items',
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
  templateUrl: './items.html',
  styleUrl: './items.scss',
})
export class Items implements OnInit {
  private readonly storage = inject(ItemStorageService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  readonly rows = signal<Item[]>([]);
  readonly filtered = signal<Item[]>([]);
  readonly search = signal('');
  readonly cols = [
    'itemCode',
    'itemName',
    'category',
    'uom',
    'qtyPerCarton',
    'status',
    'actions',
  ];

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    const all = await this.storage.getAll();
    this.rows.set(all);
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
              r.itemCode.toLowerCase().includes(q) ||
              r.itemName.toLowerCase().includes(q) ||
              r.category.toLowerCase().includes(q),
          ),
    );
  }

  openCreate(): void {
    const ref = this.dialog.open(ItemFormDialog, { width: '480px', data: null });
    ref.afterClosed().subscribe(async (ok) => {
      if (ok) await this.reload();
    });
  }

  openEdit(row: Item): void {
    const ref = this.dialog.open(ItemFormDialog, { width: '480px', data: row });
    ref.afterClosed().subscribe(async (ok) => {
      if (ok) await this.reload();
    });
  }

  async remove(row: Item): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          data: {
            title: 'Hapus Item',
            message: `Hapus item ${row.itemCode}?`,
            confirmText: 'Hapus',
            danger: true,
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    try {
      await this.storage.remove(row.id);
      this.notify.success('Item dihapus.');
      await this.reload();
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menghapus.');
    }
  }
}
