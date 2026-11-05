import { Injectable, inject } from '@angular/core';
import { db } from '../db/wms-database';
import {
  AdjustmentKind,
  CartonStatus,
  DocPrefix,
  InventoryStatus,
  MovementStatus,
  QuantityAdjustDirection,
  TransactionType,
} from '../enums';
import { CartonBarcode, MovementHeader, MovementLine } from '../models';
import { nowIso } from '../utils/date.util';
import { createId } from '../utils/id.util';
import { BarcodeService } from './barcode.service';
import { DocumentNumberService } from './document-number.service';
import { ItemStorageService } from './item-storage.service';
import { LocationStorageService } from './location-storage.service';
import { MovementStorageService } from './movement-storage.service';
import { WarehouseStorageService } from './warehouse-storage.service';

export interface MovementDraftInput {
  adjustKind: AdjustmentKind;
  qtyDirection?: QuantityAdjustDirection;
  fromWarehouseId: string;
  fromLocationId: string;
  toWarehouseId?: string;
  toLocationId?: string;
  movementDate: string;
  notes?: string;
  createdBy?: string;
}

@Injectable({ providedIn: 'root' })
export class MovementService {
  private readonly storage = inject(MovementStorageService);
  private readonly docNumbers = inject(DocumentNumberService);
  private readonly barcodeService = inject(BarcodeService);
  private readonly warehouses = inject(WarehouseStorageService);
  private readonly locations = inject(LocationStorageService);
  private readonly items = inject(ItemStorageService);

  list(): Promise<MovementHeader[]> {
    return this.storage.getAll();
  }

  get(id: string): Promise<MovementHeader | undefined> {
    return this.storage.getById(id);
  }

  async createDraft(input: MovementDraftInput): Promise<MovementHeader> {
    const kind = input.adjustKind ?? AdjustmentKind.Location;
    const fromWh = await this.warehouses.getById(input.fromWarehouseId);
    const fromLoc = await this.locations.getById(input.fromLocationId);
    if (!fromWh || !fromLoc) throw new Error('Warehouse/Location asal tidak valid.');
    if (fromLoc.warehouseId !== fromWh.id) {
      throw new Error('Location asal tidak sesuai warehouse asal.');
    }

    let toWh = fromWh;
    let toLoc = fromLoc;
    if (kind === AdjustmentKind.Location) {
      if (!input.toWarehouseId || !input.toLocationId) {
        throw new Error('Warehouse/Location tujuan wajib untuk adjust tempat.');
      }
      const tw = await this.warehouses.getById(input.toWarehouseId);
      const tl = await this.locations.getById(input.toLocationId);
      if (!tw || !tl) throw new Error('Warehouse/Location tujuan tidak valid.');
      if (tl.warehouseId !== tw.id) {
        throw new Error('Location tujuan tidak sesuai warehouse tujuan.');
      }
      if (fromLoc.id === tl.id) throw new Error('Location asal dan tujuan tidak boleh sama.');
      toWh = tw;
      toLoc = tl;
    } else if (!input.qtyDirection) {
      throw new Error('Arah qty (Increase/Decrease) wajib untuk adjust quantity.');
    }

    const stamp = nowIso();
    const doc: MovementHeader = {
      id: createId('adj'),
      docNo: await this.docNumbers.nextDocument(DocPrefix.Adjustment),
      adjustKind: kind,
      qtyDirection: kind === AdjustmentKind.Quantity ? input.qtyDirection : undefined,
      fromWarehouseId: fromWh.id,
      fromWarehouseCode: fromWh.warehouseCode,
      fromLocationId: fromLoc.id,
      fromLocationCode: fromLoc.locationCode,
      toWarehouseId: toWh.id,
      toWarehouseCode: toWh.warehouseCode,
      toLocationId: toLoc.id,
      toLocationCode: toLoc.locationCode,
      movementDate: input.movementDate || stamp,
      status: MovementStatus.Draft,
      notes: input.notes,
      totalCarton: 0,
      lines: [],
      createdBy: input.createdBy ?? 'Demo User',
      createdAt: stamp,
      updatedAt: stamp,
    };
    await this.storage.put(doc);
    return doc;
  }

  async scanBarcode(id: string, barcode: string): Promise<MovementHeader> {
    const doc = await this.requireEditable(id);
    const kind = doc.adjustKind ?? AdjustmentKind.Location;
    if (kind === AdjustmentKind.Quantity && doc.qtyDirection === QuantityAdjustDirection.Increase) {
      throw new Error('Mode qty Increase memakai form tambah item, bukan scan.');
    }

    const carton = await this.barcodeService.validateForMovement(
      barcode,
      doc.fromWarehouseId,
      doc.fromLocationId,
      doc.lines.map((l) => l.barcode).filter(Boolean),
    );
    const code = this.barcodeService.normalize(barcode);
    const line: MovementLine = {
      id: createId('mol'),
      barcode: code,
      itemId: carton.itemId,
      itemCode: carton.itemCode,
      itemName: carton.itemName,
      fromLocationId: carton.locationId,
      fromLocationCode: carton.locationCode,
      quantity: 1,
    };

    const updated: MovementHeader = {
      ...doc,
      lines: [...doc.lines, line],
      totalCarton: doc.lines.length + 1,
      status: MovementStatus.InProgress,
      updatedAt: nowIso(),
    };

    await db.transaction('rw', db.movements, db.cartons, async () => {
      const latest = await db.cartons.where('barcode').equals(code).first();
      if (!latest || latest.status !== CartonStatus.Available) {
        throw new Error(`Barcode ${code} tidak Available.`);
      }
      await db.cartons.put({
        ...latest,
        status: CartonStatus.InTransit,
        reservedDocNo: doc.docNo,
        updatedAt: nowIso(),
      });
      await db.movements.put(updated);
    });

    return updated;
  }

  async addQtyIncreaseLine(
    id: string,
    itemId: string,
    quantity: number,
  ): Promise<MovementHeader> {
    const doc = await this.requireEditable(id);
    if (
      (doc.adjustKind ?? AdjustmentKind.Location) !== AdjustmentKind.Quantity ||
      doc.qtyDirection !== QuantityAdjustDirection.Increase
    ) {
      throw new Error('Tambah item hanya untuk adjust qty Increase.');
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Quantity harus lebih dari 0.');
    }
    const item = await this.items.getById(itemId);
    if (!item) throw new Error('Item tidak valid.');

    const line: MovementLine = {
      id: createId('mol'),
      barcode: '',
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      fromLocationId: doc.fromLocationId,
      fromLocationCode: doc.fromLocationCode,
      quantity: Math.floor(quantity),
    };

    const updated: MovementHeader = {
      ...doc,
      lines: [...doc.lines, line],
      totalCarton: doc.lines.reduce((s, l) => s + (l.quantity ?? 1), 0) + line.quantity!,
      status: MovementStatus.InProgress,
      updatedAt: nowIso(),
    };
    await this.storage.put(updated);
    return updated;
  }

  async removeScanned(id: string, barcode: string): Promise<MovementHeader> {
    const doc = await this.requireEditable(id);
    const code = this.barcodeService.normalize(barcode);
    if (!doc.lines.some((l) => l.barcode === code)) {
      throw new Error(`Barcode ${code} tidak ada pada dokumen.`);
    }

    const updated: MovementHeader = {
      ...doc,
      lines: doc.lines.filter((l) => l.barcode !== code),
      totalCarton: doc.lines.length - 1,
      status: doc.lines.length - 1 > 0 ? MovementStatus.InProgress : MovementStatus.Draft,
      updatedAt: nowIso(),
    };

    await db.transaction('rw', db.movements, db.cartons, async () => {
      const carton = await db.cartons.where('barcode').equals(code).first();
      if (carton && carton.reservedDocNo === doc.docNo) {
        await db.cartons.put({
          ...carton,
          status: CartonStatus.Available,
          reservedDocNo: undefined,
          updatedAt: nowIso(),
        });
      }
      await db.movements.put(updated);
    });

    return updated;
  }

  async removeLine(id: string, lineId: string): Promise<MovementHeader> {
    const doc = await this.requireEditable(id);
    const line = doc.lines.find((l) => l.id === lineId);
    if (!line) throw new Error('Baris tidak ditemukan.');

    if (line.barcode) {
      return this.removeScanned(id, line.barcode);
    }

    const remaining = doc.lines.filter((l) => l.id !== lineId);
    const updated: MovementHeader = {
      ...doc,
      lines: remaining,
      totalCarton: remaining.reduce((s, l) => s + (l.quantity ?? 1), 0),
      status: remaining.length > 0 ? MovementStatus.InProgress : MovementStatus.Draft,
      updatedAt: nowIso(),
    };
    await this.storage.put(updated);
    return updated;
  }

  async confirm(id: string): Promise<MovementHeader> {
    const doc = await this.storage.getById(id);
    if (!doc) throw new Error('Dokumen adjustment tidak ditemukan.');
    if (doc.status === MovementStatus.Completed) {
      throw new Error('Adjustment sudah dikonfirmasi (double posting dicegah).');
    }
    if (doc.status === MovementStatus.Cancelled) {
      throw new Error('Adjustment Cancelled tidak dapat dikonfirmasi.');
    }
    if (!doc.lines.length) throw new Error('Minimal satu baris sebelum konfirmasi.');

    const kind = doc.adjustKind ?? AdjustmentKind.Location;
    if (kind === AdjustmentKind.Location) {
      return this.confirmLocation(doc);
    }
    if (doc.qtyDirection === QuantityAdjustDirection.Increase) {
      return this.confirmQtyIncrease(doc);
    }
    return this.confirmQtyDecrease(doc);
  }

  private async confirmLocation(doc: MovementHeader): Promise<MovementHeader> {
    const stamp = nowIso();
    const confirmed: MovementHeader = {
      ...doc,
      status: MovementStatus.Completed,
      confirmedAt: stamp,
      updatedAt: stamp,
      totalCarton: doc.lines.length,
    };

    await db.transaction('rw', db.movements, db.cartons, db.inventoryTransactions, db.counters, async () => {
      const latest = await db.movements.get(doc.id);
      if (!latest || latest.status === MovementStatus.Completed) {
        throw new Error('Adjustment sudah dikonfirmasi.');
      }
      for (const line of doc.lines) {
        const carton = await db.cartons.where('barcode').equals(line.barcode).first();
        if (!carton) throw new Error(`Barcode ${line.barcode} tidak ditemukan.`);
        await db.cartons.put({
          ...carton,
          warehouseId: doc.toWarehouseId,
          warehouseCode: doc.toWarehouseCode,
          locationId: doc.toLocationId,
          locationCode: doc.toLocationCode,
          status: CartonStatus.Available,
          reservedDocNo: undefined,
          lastMovementDate: stamp,
          updatedAt: stamp,
        });
        await db.inventoryTransactions.add({
          id: createId('itx'),
          transactionNumber: await this.docNumbers.nextDocument(DocPrefix.InventoryTxn),
          transactionType: TransactionType.Adjustment,
          referenceDocumentId: confirmed.id,
          referenceDocNo: confirmed.docNo,
          cartonId: carton.id,
          barcode: carton.barcode,
          fromWarehouseId: carton.warehouseId,
          fromLocationId: carton.locationId,
          toWarehouseId: doc.toWarehouseId,
          toLocationId: doc.toLocationId,
          previousStatus: carton.inventoryStatus,
          newStatus: carton.inventoryStatus,
          previousCartonStatus: carton.status,
          newCartonStatus: CartonStatus.Available,
          quantity: 1,
          transactionDate: stamp,
          notes: `Pindah lokasi ${carton.locationCode} → ${doc.toLocationCode}`,
          createdBy: confirmed.createdBy,
        });
      }
      await db.movements.put(confirmed);
    });

    return confirmed;
  }

  private async confirmQtyDecrease(doc: MovementHeader): Promise<MovementHeader> {
    const stamp = nowIso();
    const confirmed: MovementHeader = {
      ...doc,
      status: MovementStatus.Completed,
      confirmedAt: stamp,
      updatedAt: stamp,
      totalCarton: doc.lines.length,
    };

    await db.transaction('rw', db.movements, db.cartons, db.inventoryTransactions, db.counters, async () => {
      const latest = await db.movements.get(doc.id);
      if (!latest || latest.status === MovementStatus.Completed) {
        throw new Error('Adjustment sudah dikonfirmasi.');
      }
      for (const line of doc.lines) {
        const carton = await db.cartons.where('barcode').equals(line.barcode).first();
        if (!carton) throw new Error(`Barcode ${line.barcode} tidak ditemukan.`);
        await db.cartons.put({
          ...carton,
          status: CartonStatus.Inactive,
          reservedDocNo: undefined,
          lastMovementDate: stamp,
          updatedAt: stamp,
        });
        await db.inventoryTransactions.add({
          id: createId('itx'),
          transactionNumber: await this.docNumbers.nextDocument(DocPrefix.InventoryTxn),
          transactionType: TransactionType.Adjustment,
          referenceDocumentId: confirmed.id,
          referenceDocNo: confirmed.docNo,
          cartonId: carton.id,
          barcode: carton.barcode,
          fromWarehouseId: carton.warehouseId,
          fromLocationId: carton.locationId,
          previousStatus: carton.inventoryStatus,
          newStatus: carton.inventoryStatus,
          previousCartonStatus: carton.status,
          newCartonStatus: CartonStatus.Inactive,
          quantity: 1,
          transactionDate: stamp,
          notes: `Adjustment qty −1 · ${carton.locationCode}`,
          createdBy: confirmed.createdBy,
        });
      }
      await db.movements.put(confirmed);
    });

    return confirmed;
  }

  private async confirmQtyIncrease(doc: MovementHeader): Promise<MovementHeader> {
    const stamp = nowIso();
    const cartons: CartonBarcode[] = [];
    const lines: MovementLine[] = [];

    for (const line of doc.lines) {
      const qty = line.quantity ?? 0;
      if (qty <= 0) throw new Error(`Quantity item ${line.itemCode} harus > 0.`);
      const codes = await this.barcodeService.generateBarcodes(qty);
      await this.barcodeService.assertUnique(codes);
      for (const code of codes) {
        cartons.push({
          id: createId('ctn'),
          barcode: this.barcodeService.normalize(code),
          itemId: line.itemId,
          itemCode: line.itemCode,
          itemName: line.itemName,
          inboundDocNo: doc.docNo,
          warehouseId: doc.fromWarehouseId,
          warehouseCode: doc.fromWarehouseCode,
          locationId: doc.fromLocationId,
          locationCode: doc.fromLocationCode,
          receivingDate: doc.movementDate || stamp,
          status: CartonStatus.Available,
          inventoryStatus: InventoryStatus.UU,
          createdAt: stamp,
          updatedAt: stamp,
        });
      }
      lines.push({
        ...line,
        barcode: codes[0] ?? '',
        barcodes: codes,
        quantity: qty,
      });
    }

    const confirmed: MovementHeader = {
      ...doc,
      lines,
      status: MovementStatus.Completed,
      confirmedAt: stamp,
      updatedAt: stamp,
      totalCarton: cartons.length,
    };

    await db.transaction('rw', db.movements, db.cartons, db.inventoryTransactions, db.counters, async () => {
      const latest = await db.movements.get(doc.id);
      if (!latest || latest.status === MovementStatus.Completed) {
        throw new Error('Adjustment sudah dikonfirmasi.');
      }
      for (const c of cartons) {
        const exists = await db.cartons.where('barcode').equals(c.barcode).first();
        if (exists) throw new Error(`Barcode duplikat: ${c.barcode}`);
      }
      await db.cartons.bulkAdd(cartons);
      for (const c of cartons) {
        await db.inventoryTransactions.add({
          id: createId('itx'),
          transactionNumber: await this.docNumbers.nextDocument(DocPrefix.InventoryTxn),
          transactionType: TransactionType.Adjustment,
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
          notes: `Adjustment qty +1 · ${c.locationCode}`,
          createdBy: confirmed.createdBy,
        });
      }
      await db.movements.put(confirmed);
    });

    return confirmed;
  }

  async cancel(id: string): Promise<MovementHeader> {
    const doc = await this.storage.getById(id);
    if (!doc) throw new Error('Dokumen adjustment tidak ditemukan.');
    if (doc.status === MovementStatus.Completed) {
      throw new Error('Adjustment Completed tidak dapat dibatalkan.');
    }

    const updated: MovementHeader = {
      ...doc,
      status: MovementStatus.Cancelled,
      updatedAt: nowIso(),
    };

    await db.transaction('rw', db.movements, db.cartons, async () => {
      for (const line of doc.lines) {
        if (!line.barcode) continue;
        const carton = await db.cartons.where('barcode').equals(line.barcode).first();
        if (carton && carton.reservedDocNo === doc.docNo) {
          await db.cartons.put({
            ...carton,
            status: CartonStatus.Available,
            reservedDocNo: undefined,
            updatedAt: nowIso(),
          });
        }
      }
      await db.movements.put(updated);
    });

    return updated;
  }

  async deleteDraft(id: string): Promise<void> {
    const doc = await this.requireEditable(id);
    if (doc.lines.length) await this.cancel(id);
    const latest = await this.storage.getById(id);
    if (latest && latest.status !== MovementStatus.Completed) {
      await this.storage.remove(id);
    }
  }

  private async requireEditable(id: string): Promise<MovementHeader> {
    const doc = await this.storage.getById(id);
    if (!doc) throw new Error('Dokumen adjustment tidak ditemukan.');
    if (doc.status === MovementStatus.Completed || doc.status === MovementStatus.Cancelled) {
      throw new Error('Dokumen Completed/Cancelled tidak dapat diedit.');
    }
    return doc;
  }
}
