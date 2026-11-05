import { Injectable, inject } from '@angular/core';
import { db } from '../db/wms-database';
import { DocPrefix, InventoryStatus, TransactionType } from '../enums';
import { CartonBarcode, InventoryTransaction } from '../models';
import { nowIso } from '../utils/date.util';
import { createId } from '../utils/id.util';
import { DocumentNumberService } from './document-number.service';

export interface StatusChangeInput {
  carton: CartonBarcode;
  newInventoryStatus: InventoryStatus;
  transactionType: TransactionType;
  referenceDocumentId: string;
  referenceDocNo: string;
  notes?: string;
  createdBy?: string;
  toWarehouseId?: string;
  toLocationId?: string;
  toWarehouseCode?: string;
  toLocationCode?: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryTransactionService {
  private readonly docNumbers = inject(DocumentNumberService);

  list(): Promise<InventoryTransaction[]> {
    return db.inventoryTransactions.orderBy('transactionDate').reverse().toArray();
  }

  async byBarcode(barcode: string): Promise<InventoryTransaction[]> {
    const rows = await db.inventoryTransactions
      .where('barcode')
      .equals(barcode.trim().toUpperCase())
      .toArray();
    return rows.sort(
      (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime(),
    );
  }

  async byReferenceDocumentId(referenceDocumentId: string): Promise<InventoryTransaction[]> {
    const rows = await db.inventoryTransactions
      .where('referenceDocumentId')
      .equals(referenceDocumentId)
      .toArray();
    return rows.sort(
      (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime(),
    );
  }

  async recordStatusChange(input: StatusChangeInput): Promise<{
    carton: CartonBarcode;
    txn: InventoryTransaction;
  }> {
    const stamp = nowIso();
    const txn: InventoryTransaction = {
      id: createId('itx'),
      transactionNumber: await this.docNumbers.nextDocument(DocPrefix.InventoryTxn),
      transactionType: input.transactionType,
      referenceDocumentId: input.referenceDocumentId,
      referenceDocNo: input.referenceDocNo,
      cartonId: input.carton.id,
      barcode: input.carton.barcode,
      fromWarehouseId: input.carton.warehouseId,
      fromLocationId: input.carton.locationId,
      toWarehouseId: input.toWarehouseId ?? input.carton.warehouseId,
      toLocationId: input.toLocationId ?? input.carton.locationId,
      previousStatus: input.carton.inventoryStatus,
      newStatus: input.newInventoryStatus,
      previousCartonStatus: input.carton.status,
      newCartonStatus: input.carton.status,
      quantity: 1,
      transactionDate: stamp,
      notes: input.notes,
      createdBy: input.createdBy ?? 'Demo User',
    };

    const carton: CartonBarcode = {
      ...input.carton,
      inventoryStatus: input.newInventoryStatus,
      warehouseId: input.toWarehouseId ?? input.carton.warehouseId,
      warehouseCode: input.toWarehouseCode ?? input.carton.warehouseCode,
      locationId: input.toLocationId ?? input.carton.locationId,
      locationCode: input.toLocationCode ?? input.carton.locationCode,
      updatedAt: stamp,
    };

    await db.transaction('rw', db.cartons, db.inventoryTransactions, async () => {
      await db.cartons.put(carton);
      await db.inventoryTransactions.add(txn);
    });

    return { carton, txn };
  }

  async add(txn: Omit<InventoryTransaction, 'id' | 'transactionNumber'> & { transactionNumber?: string }): Promise<InventoryTransaction> {
    const full: InventoryTransaction = {
      ...txn,
      id: createId('itx'),
      transactionNumber:
        txn.transactionNumber ?? (await this.docNumbers.nextDocument(DocPrefix.InventoryTxn)),
    };
    await db.inventoryTransactions.add(full);
    return full;
  }
}
