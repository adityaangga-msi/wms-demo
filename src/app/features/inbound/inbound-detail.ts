import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { CartonQcStatus, InboundStatus } from '../../core/enums';
import { InboundHeader, Item, LocationBin, Supplier, Warehouse } from '../../core/models';
import { InboundImportService } from '../../core/services/inbound-import.service';
import { InboundService } from '../../core/services/inbound.service';
import { ItemStorageService } from '../../core/services/item-storage.service';
import { LocationStorageService } from '../../core/services/location-storage.service';
import { NotificationService } from '../../core/services/notification.service';
import { SupplierStorageService } from '../../core/services/supplier-storage.service';
import { WarehouseStorageService } from '../../core/services/warehouse-storage.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog';
import { BarcodeLabel } from '../../shared/components/barcode-label/barcode-label';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-inbound-detail',
  imports: [
    PageHeader,
    StatusBadge,
    BarcodeLabel,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    RouterLink,
  ],
  templateUrl: './inbound-detail.html',
  styleUrl: './inbound-detail.scss',
})
export class InboundDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(InboundService);
  private readonly importSvc = inject(InboundImportService);
  private readonly itemsSvc = inject(ItemStorageService);
  private readonly whSvc = inject(WarehouseStorageService);
  private readonly locSvc = inject(LocationStorageService);
  private readonly supSvc = inject(SupplierStorageService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  readonly qcOptions = Object.values(CartonQcStatus);
  readonly doc = signal<InboundHeader | null>(null);
  readonly isNew = signal(false);
  readonly editable = signal(true);
  readonly importing = signal(false);
  readonly busy = signal(false);
  readonly showIntegration = signal(false);
  readonly apiPayload = signal(this.importSvc.sampleApiPayload());
  readonly suppliers = signal<Supplier[]>([]);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly items = signal<Item[]>([]);
  readonly locations = signal<LocationBin[]>([]);

  readonly form = this.fb.nonNullable.group({
    supplierId: ['', Validators.required],
    warehouseId: ['', Validators.required],
    inboundDate: [new Date().toISOString().slice(0, 10), Validators.required],
    inspectionType: [CartonQcStatus.QI as CartonQcStatus, Validators.required],
    notes: [''],
    lines: this.fb.array([] as ReturnType<InboundDetail['createLine']>[]),
  });

  get lines(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  async ngOnInit(): Promise<void> {
    const [suppliers, warehouses, items] = await Promise.all([
      this.supSvc.getActive(),
      this.whSvc.getActive(),
      this.itemsSvc.getActive(),
    ]);
    this.suppliers.set(suppliers);
    this.warehouses.set(warehouses);
    this.items.set(items);
    this.form.get('warehouseId')?.valueChanges.subscribe((whId) => void this.loadLocations(whId));
    this.form.get('inspectionType')?.valueChanges.subscribe((t) => this.syncLineInspection(t));

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      // Hindari reload setelah createDraft + replaceUrl (bisa race dengan konfirmasi).
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
        supplierId: this.suppliers()[0]?.id ?? '',
        warehouseId: this.warehouses()[0]?.id ?? '',
        inboundDate: new Date().toISOString().slice(0, 10),
        inspectionType: CartonQcStatus.QI,
        notes: '',
      });
      this.lines.clear();
      this.addLine();
      const whId = this.form.controls.warehouseId.value;
      if (whId) await this.loadLocations(whId);
      return;
    }

    const doc = await this.service.get(id);
    if (!doc) {
      this.notify.error('Dokumen tidak ditemukan.');
      void this.router.navigate(['/operations/inbound']);
      return;
    }
    await this.applyExisting(doc);
  }

  private async applyExisting(doc: InboundHeader): Promise<void> {
    this.doc.set(doc);
    this.isNew.set(false);
    this.editable.set(
      doc.status !== InboundStatus.Completed && doc.status !== InboundStatus.Cancelled,
    );
    await this.loadLocations(doc.warehouseId);
    this.form.enable();
    this.form.patchValue({
      supplierId: doc.supplierId,
      warehouseId: doc.warehouseId,
      inboundDate: doc.inboundDate.slice(0, 10),
      inspectionType: doc.inspectionType ?? doc.lines[0]?.qcStatus ?? CartonQcStatus.QI,
      notes: doc.notes ?? '',
    });
    this.patchLinesFromDoc(doc);
    if (!this.editable()) this.form.disable();
  }

  createLine(init?: {
    itemId?: string;
    quantity?: number;
    locationId?: string;
    barcodes?: string[];
    expiredDate?: string;
    batchNo?: string;
    qcStatus?: CartonQcStatus;
    uuDate?: string;
  }) {
    const defaultExp = new Date();
    defaultExp.setFullYear(defaultExp.getFullYear() + 1);
    return this.fb.nonNullable.group({
      itemId: [init?.itemId ?? '', Validators.required],
      quantity: [init?.quantity ?? 1, [Validators.required, Validators.min(1)]],
      locationId: [init?.locationId ?? '', Validators.required],
      expiredDate: [
        init?.expiredDate ?? defaultExp.toISOString().slice(0, 10),
        Validators.required,
      ],
      batchNo: [init?.batchNo ?? ''],
      qcStatus: [init?.qcStatus ?? CartonQcStatus.QI, Validators.required],
      uuDate: [init?.uuDate ?? ''],
      barcodes: [init?.barcodes ?? ([] as string[])],
    });
  }

  addLine(): void {
    this.lines.push(this.createLine());
  }

  removeLine(index: number): void {
    this.lines.removeAt(index);
  }

  async loadLocations(warehouseId: string): Promise<void> {
    if (!warehouseId) {
      this.locations.set([]);
      return;
    }
    this.locations.set(await this.locSvc.getByWarehouse(warehouseId));
  }

  private syncLineInspection(type: CartonQcStatus): void {
    const uuDate =
      type === CartonQcStatus.UU ? new Date().toISOString().slice(0, 10) : '';
    for (const ctrl of this.lines.controls) {
      ctrl.patchValue({ qcStatus: type, uuDate: type === CartonQcStatus.UU ? uuDate : ctrl.value.uuDate }, { emitEvent: false });
    }
  }

  private draftInput() {
    const v = this.form.getRawValue();
    const inspectionType = v.inspectionType as CartonQcStatus;
    return {
      supplierId: v.supplierId,
      warehouseId: v.warehouseId,
      inboundDate: new Date(v.inboundDate).toISOString(),
      inspectionType,
      notes: v.notes || undefined,
      source: this.doc()?.source ?? ('manual' as const),
      externalSystem: this.doc()?.externalSystem,
      externalDocNo: this.doc()?.externalDocNo,
      lines: v.lines.map((l) => ({
        itemId: l.itemId,
        quantity: Number(l.quantity),
        locationId: l.locationId,
        barcodes: l.barcodes,
        expiredDate: l.expiredDate,
        batchNo: l.batchNo || undefined,
        qcStatus: inspectionType,
        uuDate:
          inspectionType === CartonQcStatus.UU
            ? l.uuDate || new Date().toISOString().slice(0, 10)
            : undefined,
      })),
    };
  }

  async saveDraft(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.error('Lengkapi header dan baris (termasuk Exp Date & Status Karton).');
      return;
    }
    this.busy.set(true);
    try {
      const saved = await this.persistDraft();
      this.notify.success(`Draft ${saved.docNo} disimpan.`);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menyimpan.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Simpan draft → generate barcode bila perlu → konfirmasi (satu alur). */
  async saveAndConfirm(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.error('Lengkapi header dan baris sebelum konfirmasi.');
      return;
    }
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          data: {
            title: 'Simpan & Konfirmasi Inbound',
            message:
              'Draft akan disimpan, barcode/QR digenerate jika belum ada, lalu stok karton ditambahkan. Lanjutkan?',
            confirmText: 'Ya, konfirmasi',
          },
        })
        .afterClosed(),
    );
    if (!ok) return;

    this.busy.set(true);
    try {
      let doc = await this.persistDraft();
      const needsGenerate = doc.lines.some((l) => l.barcodes.length !== l.quantity);
      if (needsGenerate) {
        doc = await this.service.generateBarcodes(doc.id);
        this.patchLinesFromDoc(doc);
      }
      doc = await this.service.confirm(doc.id);
      await this.applyExisting(doc);
      this.notify.success(`${doc.docNo} dikonfirmasi. Stok bertambah.`);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal konfirmasi.');
    } finally {
      this.busy.set(false);
    }
  }

  async generateBarcodes(): Promise<void> {
    this.busy.set(true);
    try {
      const saved = await this.persistDraft();
      const updated = await this.service.generateBarcodes(saved.id);
      this.patchLinesFromDoc(updated);
      this.notify.success('Barcode / QR digenerate.');
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal generate barcode.');
    } finally {
      this.busy.set(false);
    }
  }

  private async persistDraft(): Promise<InboundHeader> {
    const input = this.draftInput();
    if (this.isNew() || !this.doc()) {
      const created = await this.service.createDraft(input);
      await this.applyExisting(created);
      await this.router.navigate(['/operations/inbound', created.id], { replaceUrl: true });
      return created;
    }
    const updated = await this.service.updateDraft(this.doc()!.id, input);
    this.doc.set(updated);
    return updated;
  }

  private patchLinesFromDoc(updated: InboundHeader): void {
    this.doc.set(updated);
    this.lines.clear();
    for (const line of updated.lines) {
      this.lines.push(
        this.createLine({
          itemId: line.itemId,
          quantity: line.quantity,
          locationId: line.locationId,
          barcodes: line.barcodes,
          expiredDate: line.expiredDate?.slice(0, 10),
          batchNo: line.batchNo,
          qcStatus: line.qcStatus ?? CartonQcStatus.QI,
          uuDate: line.uuDate?.slice(0, 10),
        }),
      );
    }
  }

  async confirm(): Promise<void> {
    await this.saveAndConfirm();
  }

  async cancelDoc(): Promise<void> {
    if (this.isNew() || !this.doc()) return;
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          data: {
            title: 'Batalkan Inbound',
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
      this.doc.set(updated);
      this.editable.set(false);
      this.form.disable();
      this.notify.success('Inbound dibatalkan.');
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal membatalkan.');
    }
  }

  printLabels(): void {
    window.print();
  }

  downloadExcelTemplate(): void {
    const blob = this.importSvc.buildSampleExcel();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kartondock-inbound-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  async onExcelSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importing.set(true);
    try {
      const result = await this.importSvc.importExcelFile(file);
      this.notify.success(`Import Excel OK → ${result.docNo} (${result.lineCount} baris).`);
      void this.router.navigate(['/operations/inbound', result.draftId]);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal import Excel.');
    } finally {
      this.importing.set(false);
      input.value = '';
    }
  }

  fillSampleApi(): void {
    this.apiPayload.set(this.importSvc.sampleApiPayload());
  }

  async importFromApi(): Promise<void> {
    this.importing.set(true);
    try {
      const result = await this.importSvc.importJsonText(this.apiPayload());
      this.notify.success(`Integrasi API OK → ${result.docNo} (${result.lineCount} baris).`);
      void this.router.navigate(['/operations/inbound', result.draftId]);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal integrasi API.');
    } finally {
      this.importing.set(false);
    }
  }
}
