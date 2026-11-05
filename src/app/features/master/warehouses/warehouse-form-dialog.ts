import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MasterStatus } from '../../../core/enums';
import { Warehouse } from '../../../core/models';
import { WarehouseStorageService } from '../../../core/services/warehouse-storage.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-warehouse-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit Warehouse' : 'Tambah Warehouse' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Warehouse Code</mat-label>
          <input matInput formControlName="warehouseCode" class="mono" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Warehouse Name</mat-label>
          <input matInput formControlName="warehouseName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Address</mat-label>
          <textarea matInput rows="2" formControlName="address"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput rows="2" formControlName="description"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ s }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Batal</button>
      <button mat-flat-button class="btn-copper" type="button" [disabled]="form.invalid || saving" (click)="save()">
        Simpan
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form-grid {
      display: grid;
      gap: 0.25rem;
      min-width: min(420px, 80vw);
      padding-top: 0.35rem;
    }
  `,
})
export class WarehouseFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly storage = inject(WarehouseStorageService);
  private readonly notify = inject(NotificationService);
  private readonly ref = inject(MatDialogRef<WarehouseFormDialog, boolean>);
  readonly data = inject<Warehouse | null>(MAT_DIALOG_DATA);
  readonly statuses = Object.values(MasterStatus);
  saving = false;

  readonly form = this.fb.nonNullable.group({
    warehouseCode: [this.data?.warehouseCode ?? '', Validators.required],
    warehouseName: [this.data?.warehouseName ?? '', Validators.required],
    address: [this.data?.address ?? ''],
    description: [this.data?.description ?? ''],
    status: [this.data?.status ?? MasterStatus.Active, Validators.required],
  });

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.saving = true;
    try {
      const v = this.form.getRawValue();
      if (this.data) {
        await this.storage.update(this.data.id, v);
        this.notify.success('Warehouse diperbarui.');
      } else {
        await this.storage.create(v);
        this.notify.success('Warehouse ditambahkan.');
      }
      this.ref.close(true);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menyimpan.');
    } finally {
      this.saving = false;
    }
  }
}
