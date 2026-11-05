import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { Supplier } from '../../../core/models';
import { SupplierStorageService } from '../../../core/services/supplier-storage.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { SupplierFormDialog } from './supplier-form-dialog';

@Component({
  selector: 'app-suppliers',
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
  templateUrl: './suppliers.html',
  styleUrl: './suppliers.scss',
})
export class Suppliers implements OnInit {
  private readonly storage = inject(SupplierStorageService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  readonly rows = signal<Supplier[]>([]);
  readonly filtered = signal<Supplier[]>([]);
  readonly search = signal('');
  readonly cols = ['supplierCode', 'supplierName', 'contact', 'status', 'actions'];

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
              r.supplierCode.toLowerCase().includes(q) ||
              r.supplierName.toLowerCase().includes(q) ||
              r.contact.toLowerCase().includes(q),
          ),
    );
  }

  openCreate(): void {
    this.dialog
      .open(SupplierFormDialog, { width: '480px', data: null })
      .afterClosed()
      .subscribe(async (ok) => {
        if (ok) await this.reload();
      });
  }

  openEdit(row: Supplier): void {
    this.dialog
      .open(SupplierFormDialog, { width: '480px', data: row })
      .afterClosed()
      .subscribe(async (ok) => {
        if (ok) await this.reload();
      });
  }

  async remove(row: Supplier): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          data: {
            title: 'Hapus Supplier',
            message: `Hapus supplier ${row.supplierCode}?`,
            confirmText: 'Hapus',
            danger: true,
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    try {
      await this.storage.remove(row.id);
      this.notify.success('Supplier dihapus.');
      await this.reload();
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menghapus.');
    }
  }
}
