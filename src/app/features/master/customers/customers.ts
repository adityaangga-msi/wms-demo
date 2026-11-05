import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { Customer } from '../../../core/models';
import { CustomerStorageService } from '../../../core/services/customer-storage.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { CustomerFormDialog } from './customer-form-dialog';

@Component({
  selector: 'app-customers',
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
  templateUrl: './customers.html',
  styleUrl: './customers.scss',
})
export class Customers implements OnInit {
  private readonly storage = inject(CustomerStorageService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  readonly rows = signal<Customer[]>([]);
  readonly filtered = signal<Customer[]>([]);
  readonly search = signal('');
  readonly cols = ['customerCode', 'customerName', 'contact', 'status', 'actions'];

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
              r.customerCode.toLowerCase().includes(q) ||
              r.customerName.toLowerCase().includes(q) ||
              r.contact.toLowerCase().includes(q),
          ),
    );
  }

  openCreate(): void {
    this.dialog
      .open(CustomerFormDialog, { width: '480px', data: null })
      .afterClosed()
      .subscribe(async (ok) => {
        if (ok) await this.reload();
      });
  }

  openEdit(row: Customer): void {
    this.dialog
      .open(CustomerFormDialog, { width: '480px', data: row })
      .afterClosed()
      .subscribe(async (ok) => {
        if (ok) await this.reload();
      });
  }

  async remove(row: Customer): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          data: {
            title: 'Hapus Customer',
            message: `Hapus customer ${row.customerCode}?`,
            confirmText: 'Hapus',
            danger: true,
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    try {
      await this.storage.remove(row.id);
      this.notify.success('Customer dihapus.');
      await this.reload();
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menghapus.');
    }
  }
}
