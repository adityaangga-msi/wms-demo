import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { CartonStatus, InventoryStatus, OutboundStatus } from '../../core/enums';
import { CartonBarcode, Customer, OutboundHeader, Warehouse } from '../../core/models';
import { BarcodeStorageService } from '../../core/services/barcode-storage.service';
import { CustomerStorageService } from '../../core/services/customer-storage.service';
import { NotificationService } from '../../core/services/notification.service';
import { OutboundService } from '../../core/services/outbound.service';
import { WarehouseStorageService } from '../../core/services/warehouse-storage.service';
import { BarcodeScanner } from '../../shared/components/barcode-scanner/barcode-scanner';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-outbound-detail',
  imports: [
    PageHeader,
    StatusBadge,
    BarcodeScanner,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    RouterLink,
  ],
  templateUrl: './outbound-detail.html',
  styleUrl: './outbound-detail.scss',
})
export class OutboundDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(OutboundService);
  private readonly customersSvc = inject(CustomerStorageService);
  private readonly whSvc = inject(WarehouseStorageService);
  private readonly barcodeStorage = inject(BarcodeStorageService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  readonly doc = signal<OutboundHeader | null>(null);
  readonly isNew = signal(false);
  readonly editable = signal(true);
  readonly scanning = signal(false);
  readonly busy = signal(false);
  readonly customers = signal<Customer[]>([]);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly availableCartons = signal<CartonBarcode[]>([]);
  readonly scannedCols = ['barcode', 'item', 'actions'];
  readonly lineCols = ['itemCode', 'itemName', 'quantity'];

  readonly form = this.fb.nonNullable.group({
    customerId: ['', Validators.required],
    warehouseId: ['', Validators.required],
    outboundDate: [new Date().toISOString().slice(0, 10), Validators.required],
    notes: [''],
  });

  async ngOnInit(): Promise<void> {
    this.customers.set(await this.customersSvc.getActive());
    this.warehouses.set(await this.whSvc.getActive());
    this.form.get('warehouseId')?.valueChanges.subscribe((whId) => {
      if (!this.doc()) void this.refreshAvailable(whId, []);
    });
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id && id !== 'new' && this.doc()?.id === id) return;
      void this.loadById(id);
    });
  }

  private async loadById(id: string | null): Promise<void> {
    if (!id || id === 'new') {
      this.isNew.set(true);
      this.doc.set(null);
      this.editable.set(true);
      this.form.enable();
      this.form.reset({
        customerId: this.customers()[0]?.id ?? '',
        warehouseId: this.warehouses()[0]?.id ?? '',
        outboundDate: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      await this.refreshAvailable(this.form.controls.warehouseId.value, []);
      return;
    }
    const doc = await this.service.get(id);
    if (!doc) {
      this.notify.error('Dokumen tidak ditemukan.');
      void this.router.navigate(['/operations/outbound']);
      return;
    }
    await this.applyDoc(doc);
  }

  private async applyDoc(doc: OutboundHeader): Promise<void> {
    this.doc.set(doc);
    this.isNew.set(false);
    this.editable.set(
      doc.status !== OutboundStatus.Completed && doc.status !== OutboundStatus.Cancelled,
    );
    this.form.patchValue({
      customerId: doc.customerId,
      warehouseId: doc.warehouseId,
      outboundDate: doc.outboundDate.slice(0, 10),
      notes: doc.notes ?? '',
    });
    if (!this.editable()) this.form.disable();
    await this.refreshAvailable(doc.warehouseId, doc.scannedBarcodes);
  }

  private async refreshAvailable(warehouseId: string, scanned: string[]): Promise<void> {
    const all = await this.barcodeStorage.getAll();
    const scannedSet = new Set(scanned.map((c) => c.toUpperCase()));
    this.availableCartons.set(
      all
        .filter(
          (c) =>
            c.warehouseId === warehouseId &&
            c.status === CartonStatus.Available &&
            (c.inventoryStatus ?? InventoryStatus.UU) === InventoryStatus.UU &&
            !c.reservedDocNo &&
            !scannedSet.has(c.barcode.toUpperCase()),
        )
        .slice(0, 12),
    );
  }

  async createDraft(): Promise<void> {
    this.busy.set(true);
    try {
      const created = await this.ensureDraft();
      this.notify.success(`Draft ${created.docNo} siap. Silakan scan karton.`);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal membuat draft.');
    } finally {
      this.busy.set(false);
    }
  }

  private async ensureDraft(): Promise<OutboundHeader> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      throw new Error('Lengkapi header outbound.');
    }
    if (this.doc() && !this.isNew()) return this.doc()!;
    const v = this.form.getRawValue();
    const created = await this.service.createDraft({
      customerId: v.customerId,
      warehouseId: v.warehouseId,
      outboundDate: new Date(v.outboundDate).toISOString(),
      notes: v.notes || undefined,
    });
    await this.applyDoc(created);
    await this.router.navigate(['/operations/outbound', created.id], { replaceUrl: true });
    return created;
  }

  async onScan(barcode: string): Promise<void> {
    if (!this.editable() || this.scanning()) return;
    this.scanning.set(true);
    try {
      const doc = await this.ensureDraft();
      const updated = await this.service.scanBarcode(doc.id, barcode);
      await this.applyDoc(updated);
      this.notify.success(`Scan ${barcode} OK.`);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Scan gagal.');
    } finally {
      this.scanning.set(false);
    }
  }

  async removeBarcode(barcode: string): Promise<void> {
    if (!this.doc() || !this.editable()) return;
    try {
      const updated = await this.service.removeScanned(this.doc()!.id, barcode);
      await this.applyDoc(updated);
      this.notify.success(`Barcode ${barcode} dihapus.`);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menghapus.');
    }
  }

  async confirm(): Promise<void> {
    if (!this.doc()?.scannedBarcodes.length) {
      this.notify.error('Scan minimal satu karton sebelum konfirmasi.');
      return;
    }
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          data: {
            title: 'Konfirmasi Outbound',
            message: `Konfirmasi ${this.doc()?.docNo}? Karton akan berstatus Shipped.`,
            confirmText: 'Ya, konfirmasi',
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    this.busy.set(true);
    try {
      const updated = await this.service.confirm(this.doc()!.id);
      await this.applyDoc(updated);
      this.notify.success('Outbound dikonfirmasi.');
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal konfirmasi.');
    } finally {
      this.busy.set(false);
    }
  }

  async cancelDoc(): Promise<void> {
    if (!this.doc()) return;
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          data: {
            title: 'Batalkan Outbound',
            message: `Batalkan ${this.doc()?.docNo}?`,
            confirmText: 'Batalkan',
            danger: true,
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    try {
      const updated = await this.service.cancel(this.doc()!.id);
      await this.applyDoc(updated);
      this.notify.success('Outbound dibatalkan.');
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal membatalkan.');
    }
  }

  itemForBarcode(code: string): string {
    const line = this.doc()?.lines.find((l) => l.barcodes.includes(code));
    return line ? `${line.itemCode} — ${line.itemName}` : '—';
  }
}
