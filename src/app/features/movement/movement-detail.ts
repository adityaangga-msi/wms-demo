import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import {
  AdjustmentKind,
  CartonStatus,
  InventoryStatus,
  MovementStatus,
  QuantityAdjustDirection,
} from '../../core/enums';
import {
  CartonBarcode,
  Item,
  LocationBin,
  MovementHeader,
  Warehouse,
} from '../../core/models';
import { BarcodeStorageService } from '../../core/services/barcode-storage.service';
import { ItemStorageService } from '../../core/services/item-storage.service';
import { LocationStorageService } from '../../core/services/location-storage.service';
import { MovementService } from '../../core/services/movement.service';
import { NotificationService } from '../../core/services/notification.service';
import { WarehouseStorageService } from '../../core/services/warehouse-storage.service';
import { BarcodeScanner } from '../../shared/components/barcode-scanner/barcode-scanner';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-movement-detail',
  imports: [
    PageHeader,
    StatusBadge,
    BarcodeScanner,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatTableModule,
    RouterLink,
  ],
  templateUrl: './movement-detail.html',
  styleUrl: './movement-detail.scss',
})
export class MovementDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(MovementService);
  private readonly whSvc = inject(WarehouseStorageService);
  private readonly locSvc = inject(LocationStorageService);
  private readonly itemSvc = inject(ItemStorageService);
  private readonly barcodeStorage = inject(BarcodeStorageService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  readonly AdjustmentKind = AdjustmentKind;
  readonly QuantityAdjustDirection = QuantityAdjustDirection;

  readonly doc = signal<MovementHeader | null>(null);
  readonly isNew = signal(false);
  readonly editable = signal(true);
  readonly busy = signal(false);
  readonly scanning = signal(false);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly items = signal<Item[]>([]);
  readonly fromLocations = signal<LocationBin[]>([]);
  readonly toLocations = signal<LocationBin[]>([]);
  readonly availableCartons = signal<CartonBarcode[]>([]);
  readonly lineCols = ['barcode', 'itemCode', 'itemName', 'qty', 'actions'];

  readonly form = this.fb.nonNullable.group({
    adjustKind: [AdjustmentKind.Location as AdjustmentKind, Validators.required],
    qtyDirection: [QuantityAdjustDirection.Decrease as QuantityAdjustDirection],
    fromWarehouseId: ['', Validators.required],
    fromLocationId: ['', Validators.required],
    toWarehouseId: ['', Validators.required],
    toLocationId: ['', Validators.required],
    movementDate: [new Date().toISOString().slice(0, 10), Validators.required],
    notes: [''],
  });

  readonly qtyForm = this.fb.nonNullable.group({
    itemId: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
  });

  async ngOnInit(): Promise<void> {
    this.warehouses.set(await this.whSvc.getActive());
    this.items.set(await this.itemSvc.getActive());
    this.form.get('fromWarehouseId')?.valueChanges.subscribe((id) => {
      void this.loadFromLoc(id);
      void this.refreshAvailable();
    });
    this.form.get('fromLocationId')?.valueChanges.subscribe(() => void this.refreshAvailable());
    this.form.get('toWarehouseId')?.valueChanges.subscribe((id) => void this.loadToLoc(id));
    this.form.get('adjustKind')?.valueChanges.subscribe((kind) => this.onKindChange(kind));
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id && id !== 'new' && this.doc()?.id === id) return;
      void this.loadById(id);
    });
  }

  get isLocation(): boolean {
    return this.form.controls.adjustKind.value === AdjustmentKind.Location;
  }

  get isQtyIncrease(): boolean {
    return (
      this.form.controls.adjustKind.value === AdjustmentKind.Quantity &&
      this.form.controls.qtyDirection.value === QuantityAdjustDirection.Increase
    );
  }

  get usesScan(): boolean {
    return !this.isQtyIncrease;
  }

  private onKindChange(kind: AdjustmentKind): void {
    const toWh = this.form.controls.toWarehouseId;
    const toLoc = this.form.controls.toLocationId;
    if (kind === AdjustmentKind.Location) {
      toWh.setValidators([Validators.required]);
      toLoc.setValidators([Validators.required]);
    } else {
      toWh.clearValidators();
      toLoc.clearValidators();
    }
    toWh.updateValueAndValidity({ emitEvent: false });
    toLoc.updateValueAndValidity({ emitEvent: false });
    void this.refreshAvailable();
  }

  private async loadById(id: string | null): Promise<void> {
    if (!id || id === 'new') {
      this.isNew.set(true);
      this.doc.set(null);
      this.editable.set(true);
      this.form.enable();
      const wh = this.warehouses()[0];
      this.form.reset({
        adjustKind: AdjustmentKind.Location,
        qtyDirection: QuantityAdjustDirection.Decrease,
        fromWarehouseId: wh?.id ?? '',
        fromLocationId: '',
        toWarehouseId: wh?.id ?? '',
        toLocationId: '',
        movementDate: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      this.onKindChange(AdjustmentKind.Location);
      if (wh) {
        await Promise.all([this.loadFromLoc(wh.id), this.loadToLoc(wh.id)]);
        const fromLoc = this.fromLocations()[0];
        const toLoc = this.toLocations()[1] ?? this.toLocations()[0];
        this.form.patchValue({
          fromLocationId: fromLoc?.id ?? '',
          toLocationId: toLoc?.id ?? '',
        });
      }
      this.qtyForm.reset({ itemId: this.items()[0]?.id ?? '', quantity: 1 });
      await this.refreshAvailable();
      return;
    }
    const doc = await this.service.get(id);
    if (!doc) {
      this.notify.error('Dokumen tidak ditemukan.');
      void this.router.navigate(['/operations/adjustment']);
      return;
    }
    await this.applyDoc(doc);
  }

  private async loadFromLoc(warehouseId: string): Promise<void> {
    this.fromLocations.set(warehouseId ? await this.locSvc.getByWarehouse(warehouseId) : []);
  }

  private async loadToLoc(warehouseId: string): Promise<void> {
    this.toLocations.set(warehouseId ? await this.locSvc.getByWarehouse(warehouseId) : []);
  }

  private async applyDoc(doc: MovementHeader): Promise<void> {
    this.doc.set(doc);
    this.isNew.set(false);
    this.editable.set(
      doc.status !== MovementStatus.Completed && doc.status !== MovementStatus.Cancelled,
    );
    await Promise.all([
      this.loadFromLoc(doc.fromWarehouseId),
      this.loadToLoc(doc.toWarehouseId),
    ]);
    this.form.enable();
    this.form.patchValue({
      adjustKind: doc.adjustKind ?? AdjustmentKind.Location,
      qtyDirection: doc.qtyDirection ?? QuantityAdjustDirection.Decrease,
      fromWarehouseId: doc.fromWarehouseId,
      fromLocationId: doc.fromLocationId,
      toWarehouseId: doc.toWarehouseId,
      toLocationId: doc.toLocationId,
      movementDate: doc.movementDate.slice(0, 10),
      notes: doc.notes ?? '',
    });
    this.onKindChange(doc.adjustKind ?? AdjustmentKind.Location);
    if (!this.editable()) this.form.disable();
    await this.refreshAvailable();
  }

  private async refreshAvailable(): Promise<void> {
    if (!this.usesScan) {
      this.availableCartons.set([]);
      return;
    }
    const whId = this.doc()?.fromWarehouseId ?? this.form.controls.fromWarehouseId.value;
    const locId = this.doc()?.fromLocationId ?? this.form.controls.fromLocationId.value;
    if (!whId || !locId) {
      this.availableCartons.set([]);
      return;
    }
    const scanned = new Set(
      (this.doc()?.lines ?? []).map((l) => l.barcode?.toUpperCase()).filter(Boolean),
    );
    const all = await this.barcodeStorage.getAll();
    this.availableCartons.set(
      all
        .filter(
          (c) =>
            c.warehouseId === whId &&
            c.locationId === locId &&
            c.status === CartonStatus.Available &&
            (c.inventoryStatus ?? InventoryStatus.UU) === InventoryStatus.UU &&
            !c.reservedDocNo &&
            !scanned.has(c.barcode.toUpperCase()),
        )
        .slice(0, 12),
    );
  }

  async createDraft(): Promise<void> {
    this.busy.set(true);
    try {
      const created = await this.ensureDraft();
      this.notify.success(`Draft ${created.docNo} siap.`);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal membuat draft.');
    } finally {
      this.busy.set(false);
    }
  }

  private async ensureDraft(): Promise<MovementHeader> {
    this.onKindChange(this.form.controls.adjustKind.value);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      throw new Error('Lengkapi header adjustment.');
    }
    if (this.doc() && !this.isNew()) return this.doc()!;
    const v = this.form.getRawValue();
    const created = await this.service.createDraft({
      adjustKind: v.adjustKind,
      qtyDirection:
        v.adjustKind === AdjustmentKind.Quantity ? v.qtyDirection : undefined,
      fromWarehouseId: v.fromWarehouseId,
      fromLocationId: v.fromLocationId,
      toWarehouseId: v.toWarehouseId,
      toLocationId: v.toLocationId,
      movementDate: new Date(v.movementDate).toISOString(),
      notes: v.notes || undefined,
    });
    await this.applyDoc(created);
    await this.router.navigate(['/operations/adjustment', created.id], { replaceUrl: true });
    return created;
  }

  async onScan(barcode: string): Promise<void> {
    if (!this.editable() || this.scanning() || !this.usesScan) return;
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

  async addQtyLine(): Promise<void> {
    if (!this.editable() || !this.isQtyIncrease) return;
    if (this.qtyForm.invalid) {
      this.qtyForm.markAllAsTouched();
      this.notify.error('Pilih item dan qty > 0.');
      return;
    }
    this.busy.set(true);
    try {
      const doc = await this.ensureDraft();
      const v = this.qtyForm.getRawValue();
      const updated = await this.service.addQtyIncreaseLine(doc.id, v.itemId, v.quantity);
      await this.applyDoc(updated);
      this.notify.success(`+${v.quantity} ${updated.lines.at(-1)?.itemCode} ditambahkan.`);
      this.qtyForm.patchValue({ quantity: 1 });
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menambah qty.');
    } finally {
      this.busy.set(false);
    }
  }

  async removeLine(lineId: string): Promise<void> {
    if (!this.doc() || !this.editable()) return;
    try {
      const updated = await this.service.removeLine(this.doc()!.id, lineId);
      await this.applyDoc(updated);
      this.notify.success('Baris dihapus.');
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menghapus.');
    }
  }

  confirmMessage(doc: MovementHeader): string {
    const kind = doc.adjustKind ?? AdjustmentKind.Location;
    if (kind === AdjustmentKind.Location) {
      return `Konfirmasi ${doc.docNo}? Lokasi karton dipindah ke ${doc.toWarehouseCode}/${doc.toLocationCode}.`;
    }
    if (doc.qtyDirection === QuantityAdjustDirection.Increase) {
      return `Konfirmasi ${doc.docNo}? Stok bertambah (karton baru digenerate).`;
    }
    return `Konfirmasi ${doc.docNo}? Karton terpilih akan di-Inactive (qty berkurang).`;
  }

  async confirm(): Promise<void> {
    if (!this.doc()?.lines.length) {
      this.notify.error('Minimal satu baris sebelum konfirmasi.');
      return;
    }
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          data: {
            title: 'Konfirmasi Adjustment',
            message: this.confirmMessage(this.doc()!),
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
      this.notify.success('Adjustment dikonfirmasi.');
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
            title: 'Batalkan Adjustment',
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
      this.notify.success('Adjustment dibatalkan.');
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal membatalkan.');
    }
  }

  lineQty(row: { quantity?: number; barcodes?: string[] }): number {
    return row.quantity ?? row.barcodes?.length ?? 1;
  }

  kindLabel(doc: MovementHeader): string {
    const kind = doc.adjustKind ?? AdjustmentKind.Location;
    if (kind === AdjustmentKind.Location) return 'Tempat';
    return doc.qtyDirection === QuantityAdjustDirection.Increase ? 'Qty +' : 'Qty −';
  }
}
