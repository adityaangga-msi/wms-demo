import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MasterStatus } from '../../../core/enums';
import { Item } from '../../../core/models';
import { ItemStorageService } from '../../../core/services/item-storage.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-item-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit Item' : 'Tambah Item' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Item Code</mat-label>
          <input matInput formControlName="itemCode" class="mono" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Item Name</mat-label>
          <input matInput formControlName="itemName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <input matInput formControlName="category" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput rows="2" formControlName="description"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Qty per Karton</mat-label>
          <input matInput type="number" min="0.001" step="any" formControlName="qtyPerCarton" />
          <mat-hint>Isi 1 karton (contoh 12)</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Satuan isi</mat-label>
          <mat-select formControlName="contentUom">
            @for (u of contentUoms; track u) {
              <mat-option [value]="u">{{ u }}</mat-option>
            }
          </mat-select>
          <mat-hint>Pcs / Kg / Liter / dll</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Barcode Config</mat-label>
          <input matInput formControlName="barcodeConfig" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ s }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <p class="preview">
          Stok UOM: <b>Karton</b> · contoh 10 karton =
          <b>{{ previewContent() }}</b>
        </p>
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
      min-width: min(440px, 80vw);
      padding-top: 0.35rem;
    }
    .preview {
      margin: 0.25rem 0 0.5rem;
      font-size: 0.85rem;
      color: #475569;
    }
  `,
})
export class ItemFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly storage = inject(ItemStorageService);
  private readonly notify = inject(NotificationService);
  private readonly ref = inject(MatDialogRef<ItemFormDialog, boolean>);
  readonly data = inject<Item | null>(MAT_DIALOG_DATA);

  readonly statuses = Object.values(MasterStatus);
  readonly contentUoms = ['Pcs', 'Kg', 'Gram', 'Liter', 'Ml', 'Botol', 'Pack', 'Sachet'];
  saving = false;

  readonly form = this.fb.nonNullable.group({
    itemCode: [this.data?.itemCode ?? '', Validators.required],
    itemName: [this.data?.itemName ?? '', Validators.required],
    category: [this.data?.category ?? '', Validators.required],
    description: [this.data?.description ?? ''],
    qtyPerCarton: [this.data?.qtyPerCarton ?? 12, [Validators.required, Validators.min(0.001)]],
    contentUom: [this.data?.contentUom ?? 'Pcs', Validators.required],
    barcodeConfig: [this.data?.barcodeConfig ?? 'CTN', Validators.required],
    status: [this.data?.status ?? MasterStatus.Active, Validators.required],
  });

  previewContent(): string {
    const qty = Number(this.form.controls.qtyPerCarton.value) || 0;
    const uom = this.form.controls.contentUom.value || 'Pcs';
    const total = 10 * qty;
    const pretty = Number.isInteger(total)
      ? String(total)
      : total.toLocaleString('id-ID', { maximumFractionDigits: 3 });
    return `${pretty} ${uom}`;
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.saving = true;
    try {
      const v = this.form.getRawValue();
      const payload = {
        itemCode: v.itemCode.trim(),
        itemName: v.itemName.trim(),
        category: v.category.trim(),
        description: v.description.trim(),
        qtyPerCarton: Number(v.qtyPerCarton),
        contentUom: v.contentUom,
        barcodeConfig: v.barcodeConfig.trim(),
        status: v.status,
      };
      if (this.data) {
        await this.storage.update(this.data.id, payload);
        this.notify.success('Item diperbarui.');
      } else {
        await this.storage.create(payload);
        this.notify.success('Item ditambahkan.');
      }
      this.ref.close(true);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menyimpan.');
    } finally {
      this.saving = false;
    }
  }
}
