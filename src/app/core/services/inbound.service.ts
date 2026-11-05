import { Injectable, inject } from '@angular/core';
import { db } from '../db/wms-database';
import {
  CartonQcStatus,
  CartonStatus,
  DocPrefix,
  InboundStatus,
  InventoryStatus,
  TransactionType,
} from '../enums';
import { CartonBarcode, InboundHeader, InboundLine } from '../models';
import { nowIso } from '../utils/date.util';
import { createId } from '../utils/id.util';
import { DocumentNumberService } from './document-number.service';
import { InboundStorageService } from './inbound-storage.service';
import { BarcodeService } from './barcode.service';
import { LocationStorageService } from './location-storage.service';
import { ItemStorageService } from './item-storage.service';
import { SupplierStorageService } from './supplier-storage.service';
import { WarehouseStorageService } from './warehouse-storage.service';
import { QiService } from './qi.service';

export interface InboundLineInput {
  itemId: string;
  quantity: number;
  locationId: string;
  barcodes?: string[];
  expiredDate?: string;
  batchNo?: string;
  qcStatus?: CartonQcStatus;
  uuDate?: string;
  externalRef?: string;
}

export interface InboundDraftInput {
  supplierId: string;
  warehouseId: string;
  inboundDate: string;
  /** Header-level inspection type; syncs to line qcStatus. */
  inspectionType?: CartonQcStatus;
  notes?: string;
  lines: InboundLineInput[];
  createdBy?: string;
  source?: InboundHeader['source'];
  externalSystem?: string;
  externalDocNo?: string;
}

@Injectable({ providedIn: 'root' })
export class InboundService {
  private readonly storage = inject(InboundStorageService);
  private readonly docNumbers = inject(DocumentNumberService);
  private readonly barcodeService = inject(BarcodeService);
  private readonly items = inject(ItemStorageService);
  private readonly warehouses = inject(WarehouseStorageService);
  private readonly locations = inject(LocationStorageService);
  private readonly suppliers = inject(SupplierStorageService);
  private readonly qi = inject(QiService);

  list(): Promise<InboundHeader[]> {
    return this.storage.getAll();
  }

  get(id: string): Promise<InboundHeader | undefined> {
    return this.storage.getById(id);
  }

  async createDraft(input: InboundDraftInput): Promise<InboundHeader> {
    const header = await this.buildHeader(input, InboundStatus.Draft);
    await this.storage.put(header);
    return header;
  }

  async updateDraft(id: string, input: InboundDraftInput): Promise<InboundHeader> {
    const current = await this.requireEditable(id);
    const rebuilt = await this.buildHeader(
      input,
      current.status === InboundStatus.Receiving ? InboundStatus.Receiving : InboundStatus.Draft,
      current,
    );
    await this.storage.put(rebuilt);
    return rebuilt;
  }

  async generateBarcodes(id: string): Promise<InboundHeader> {
    const doc = await this.requireEditable(id);
    const lines: InboundLine[] = [];
    for (const line of doc.lines) {
      if (line.barcodes.length === line.quantity) {
        lines.push(line);
        continue;
      }
      const needed = line.quantity - line.barcodes.length;
      const generated = needed > 0 ? await this.barcodeService.generateBarcodes(needed) : [];
      lines.push({ ...line, barcodes: [...line.barcodes, ...generated] });
    }
    const updated: InboundHeader = {
      ...doc,
      lines,
      status: InboundStatus.Receiving,
      totalCarton: lines.reduce((s, l) => s + l.quantity, 0),
      updatedAt: nowIso(),
    };
    await this.storage.put(updated);
    return updated;
  }

  async deleteDraft(id: string): Promise<void> {
    const doc = await this.requireEditable(id);
    await this.storage.remove(doc.id);
  }

  async cancel(id: string): Promise<InboundHeader> {
    const doc = await this.storage.getById(id);
    if (!doc) throw new Error('Dokumen inbound tidak ditemukan.');
    if (doc.status === InboundStatus.Completed) {
      throw new Error('Inbound Completed tidak dapat dibatalkan.');
    }
    const updated: InboundHeader = {
      ...doc,
      status: InboundStatus.Cancelled,
      updatedAt: nowIso(),
    };
    await this.storage.put(updated);
    return updated;
  }

  async confirm(id: string): Promise<InboundHeader> {
    const doc = await this.storage.getById(id);
    if (!doc) throw new Error('Dokumen inbound tidak ditemukan.');
    if (doc.status === InboundStatus.Completed) {
      throw new Error('Inbound sudah dikonfirmasi sebelumnya (double posting dicegah).');
    }
    if (doc.status === InboundStatus.Cancelled) {
      throw new Error('Inbound Cancelled tidak dapat dikonfirmasi.');
    }
    if (!doc.lines.length) throw new Error('Inbound tidak memiliki baris barang.');

    const inspectionType =
      doc.inspectionType ??
      (doc.lines.every((l) => l.qcStatus === CartonQcStatus.UU)
        ? CartonQcStatus.UU
        : CartonQcStatus.QI);

    for (const line of doc.lines) {
      if (line.quantity <= 0) throw new Error(`Quantity item ${line.itemCode} harus > 0.`);
      if (!line.expiredDate) throw new Error(`Item ${line.itemCode}: Expired Date wajib.`);
      if (line.barcodes.length !== line.quantity) {
        throw new Error(
          `Item ${line.itemCode}: jumlah barcode (${line.barcodes.length}) harus sama dengan quantity (${line.quantity}). Generate/scan barcode terlebih dahulu.`,
        );
      }
      await this.barcodeService.assertUnique(line.barcodes);
    }

    const stamp = nowIso();
    const inventoryStatus =
      inspectionType === CartonQcStatus.UU ? InventoryStatus.UU : InventoryStatus.QiPending;

    const cartons: CartonBarcode[] = [];
    for (const line of doc.lines) {
      for (const code of line.barcodes) {
        cartons.push({
          id: createId('ctn'),
          barcode: this.barcodeService.normalize(code),
          itemId: line.itemId,
          itemCode: line.itemCode,
          itemName: line.itemName,
          inboundId: doc.id,
          inboundDocNo: doc.docNo,
          inboundLineId: line.id,
          warehouseId: doc.warehouseId,
          warehouseCode: doc.warehouseCode,
          locationId: line.locationId,
          locationCode: line.locationCode,
          receivingDate: doc.inboundDate || stamp,
          status: CartonStatus.Available,
          inventoryStatus,
          qcStatus: inspectionType,
          batchNo: line.batchNo,
          expiredDate: line.expiredDate,
          uuDate: inspectionType === CartonQcStatus.UU ? line.uuDate || stamp.slice(0, 10) : undefined,
          externalRef: line.externalRef,
          createdAt: stamp,
          updatedAt: stamp,
        });
      }
    }

    const confirmed: InboundHeader = {
      ...doc,
      inspectionType,
      status: InboundStatus.Completed,
      totalCarton: cartons.length,
      confirmedAt: stamp,
      updatedAt: stamp,
    };

    await db.transaction(
      'rw',
      db.inbounds,
      db.cartons,
      db.inventoryTransactions,
      db.counters,
      async () => {
        const latest = await db.inbounds.get(id);
        if (!latest || latest.status === InboundStatus.Completed) {
          throw new Error('Inbound sudah dikonfirmasi (race condition dicegah).');
        }
        for (const c of cartons) {
          const exists = await db.cartons.where('barcode').equals(c.barcode).first();
          if (exists) throw new Error(`Barcode duplikat: ${c.barcode}`);
        }
        await db.cartons.bulkAdd(cartons);
        await db.inbounds.put(confirmed);

        if (inspectionType === CartonQcStatus.UU) {
          for (const c of cartons) {
            await db.inventoryTransactions.add({
              id: createId('itx'),
              transactionNumber: await this.docNumbers.nextDocument(DocPrefix.InventoryTxn),
              transactionType: TransactionType.Inbound,
              referenceDocumentId: confirmed.id,
              referenceDocNo: confirmed.docNo,
              cartonId: c.id,
              barcode: c.barcode,
              toWarehouseId: c.warehouseId,
              toLocationId: c.locationId,
              newStatus: InventoryStatus.UU,
              newCartonStatus: CartonStatus.Available,
              quantity: 1,
              transactionDate: stamp,
              notes: 'Inbound UU — langsung Unrestricted Use',
              createdBy: confirmed.createdBy,
            });
          }
        }
      },
    );

    if (inspectionType === CartonQcStatus.QI) {
      const qi = await this.qi.createFromInbound(confirmed, cartons);
      return { ...confirmed, qiHeaderId: qi.id, qiDocNo: qi.docNo };
    }

    return confirmed;
  }

  private async requireEditable(id: string): Promise<InboundHeader> {
    const doc = await this.storage.getById(id);
    if (!doc) throw new Error('Dokumen inbound tidak ditemukan.');
    if (doc.status === InboundStatus.Completed || doc.status === InboundStatus.Cancelled) {
      throw new Error('Dokumen Completed/Cancelled tidak dapat diedit.');
    }
    return doc;
  }

  private async buildHeader(
    input: InboundDraftInput,
    status: InboundStatus,
    existing?: InboundHeader,
  ): Promise<InboundHeader> {
    const supplier = await this.suppliers.getById(input.supplierId);
    const warehouse = await this.warehouses.getById(input.warehouseId);
    if (!supplier) throw new Error('Supplier tidak valid.');
    if (!warehouse) throw new Error('Warehouse tidak valid.');
    if (!input.lines?.length) throw new Error('Minimal satu baris barang.');

    const lines: InboundLine[] = [];
    for (const raw of input.lines) {
      if (raw.quantity <= 0) throw new Error('Quantity harus lebih dari 0.');
      const item = await this.items.getById(raw.itemId);
      const location = await this.locations.getById(raw.locationId);
      if (!item) throw new Error('Item tidak valid.');
      if (!location) throw new Error('Location tidak valid.');
      if (location.warehouseId !== warehouse.id) {
        throw new Error(
          `Location ${location.locationCode} bukan milik warehouse ${warehouse.warehouseCode}.`,
        );
      }
      const inspectionType = input.inspectionType ?? raw.qcStatus ?? CartonQcStatus.QI;
      const qcStatus = inspectionType;
      if (qcStatus === CartonQcStatus.UU && !raw.uuDate) {
        // allow missing uuDate on draft; confirm will set from stamp
      }
      if (!raw.expiredDate) {
        throw new Error(`Item ${item.itemCode}: Expired Date wajib.`);
      }
      const barcodes = (raw.barcodes ?? []).map((b) => this.barcodeService.normalize(b));
      lines.push({
        id: createId('inl'),
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantity: raw.quantity,
        locationId: location.id,
        locationCode: location.locationCode,
        barcodes,
        expiredDate: raw.expiredDate,
        batchNo: raw.batchNo?.trim() || undefined,
        qcStatus,
        uuDate: raw.uuDate || undefined,
        externalRef: raw.externalRef,
      });
    }

    const inspectionType =
      input.inspectionType ??
      (lines.every((l) => l.qcStatus === CartonQcStatus.UU)
        ? CartonQcStatus.UU
        : CartonQcStatus.QI);

    // Sync all lines to header inspection type
    for (const line of lines) {
      line.qcStatus = inspectionType;
    }

    if (inspectionType === CartonQcStatus.UU) {
      for (const line of lines) {
        if (!line.uuDate) line.uuDate = (input.inboundDate || nowIso()).slice(0, 10);
      }
    }

    const stamp = nowIso();
    return {
      id: existing?.id ?? createId('inb'),
      docNo: existing?.docNo ?? (await this.docNumbers.nextDocument(DocPrefix.Inbound)),
      supplierId: supplier.id,
      supplierCode: supplier.supplierCode,
      supplierName: supplier.supplierName,
      warehouseId: warehouse.id,
      warehouseCode: warehouse.warehouseCode,
      inboundDate: input.inboundDate || stamp,
      inspectionType,
      status,
      notes: input.notes,
      totalCarton: lines.reduce((s, l) => s + l.quantity, 0),
      lines,
      createdBy: existing?.createdBy ?? input.createdBy ?? 'Demo User',
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
      confirmedAt: existing?.confirmedAt,
      source: input.source ?? existing?.source ?? 'manual',
      externalSystem: input.externalSystem ?? existing?.externalSystem,
      externalDocNo: input.externalDocNo ?? existing?.externalDocNo,
      qiHeaderId: existing?.qiHeaderId,
      qiDocNo: existing?.qiDocNo,
    };
  }
}
