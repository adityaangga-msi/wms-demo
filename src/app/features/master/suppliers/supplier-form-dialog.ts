import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MasterStatus } from '../../../core/enums';
import { Supplier } from '../../../core/models';
import { SupplierStorageService } from '../../../core/services/supplier-storage.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-supplier-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit Supplier' : 'Tambah Supplier' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Supplier Code</mat-label>
          <input matInput formControlName="supplierCode" class="mono" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Supplier Name</mat-label>
          <input matInput formControlName="supplierName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Address</mat-label>
          <textarea matInput rows="2" formControlName="address"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Contact</mat-label>
          <input matInput formControlName="contact" />
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
export class SupplierFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly storage = inject(SupplierStorageService);
  private readonly notify = inject(NotificationService);
  private readonly ref = inject(MatDialogRef<SupplierFormDialog, boolean>);
  readonly data = inject<Supplier | null>(MAT_DIALOG_DATA);
  readonly statuses = Object.values(MasterStatus);
  saving = false;

  readonly form = this.fb.nonNullable.group({
    supplierCode: [this.data?.supplierCode ?? '', Validators.required],
    supplierName: [this.data?.supplierName ?? '', Validators.required],
    address: [this.data?.address ?? ''],
    contact: [this.data?.contact ?? ''],
    status: [this.data?.status ?? MasterStatus.Active, Validators.required],
  });

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.saving = true;
    try {
      const v = this.form.getRawValue();
      if (this.data) {
        await this.storage.update(this.data.id, v);
        this.notify.success('Supplier diperbarui.');
      } else {
        await this.storage.create(v);
        this.notify.success('Supplier ditambahkan.');
      }
      this.ref.close(true);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menyimpan.');
    } finally {
      this.saving = false;
    }
  }
}
