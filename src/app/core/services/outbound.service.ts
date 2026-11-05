import { Injectable, inject } from '@angular/core';
import { db } from '../db/wms-database';
import { CartonStatus, DocPrefix, OutboundStatus, TransactionType } from '../enums';
import { OutboundHeader, OutboundLine } from '../models';
import { nowIso } from '../utils/date.util';
import { createId } from '../utils/id.util';
import { BarcodeService } from './barcode.service';
import { CustomerStorageService } from './customer-storage.service';
import { DocumentNumberService } from './document-number.service';
import { OutboundStorageService } from './outbound-storage.service';
import { WarehouseStorageService } from './warehouse-storage.service';

export interface OutboundDraftInput {
  customerId: string;
  warehouseId: string;
  outboundDate: string;
  notes?: string;
  createdBy?: string;
}

@Injectable({ providedIn: 'root' })
export class OutboundService {
  private readonly storage = inject(OutboundStorageService);
  private readonly docNumbers = inject(DocumentNumberService);
  private readonly barcodeService = inject(BarcodeService);
  private readonly customers = inject(CustomerStorageService);
  private readonly warehouses = inject(WarehouseStorageService);

  list(): Promise<OutboundHeader[]> {
    return this.storage.getAll();
  }

  get(id: string): Promise<OutboundHeader | undefined> {
    return this.storage.getById(id);
  }

  async createDraft(input: OutboundDraftInput): Promise<OutboundHeader> {
    const customer = await this.customers.getById(input.customerId);
    const warehouse = await this.warehouses.getById(input.warehouseId);
    if (!customer) throw new Error('Customer tidak valid.');
    if (!warehouse) throw new Error('Warehouse tidak valid.');
    const stamp = nowIso();
    const doc: OutboundHeader = {
      id: createId('out'),
      docNo: await this.docNumbers.nextDocument(DocPrefix.Outbound),
      customerId: customer.id,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      warehouseId: warehouse.id,
      warehouseCode: warehouse.warehouseCode,
      outboundDate: input.outboundDate || stamp,
      status: OutboundStatus.Draft,
      notes: input.notes,
      totalCarton: 0,
      lines: [],
      scannedBarcodes: [],
      createdBy: input.createdBy ?? 'Demo User',
      createdAt: stamp,
      updatedAt: stamp,
    };
    await this.storage.put(doc);
    return doc;
  }

  async scanBarcode(id: string, barcode: string): Promise<OutboundHeader> {
    const doc = await this.requireEditable(id);
    const carton = await this.barcodeService.validateForOutbound(
      barcode,
      doc.warehouseId,
      doc.scannedBarcodes,
    );

    const code = this.barcodeService.normalize(barcode);
    const lines = [...doc.lines];
    let line = lines.find((l) => l.itemId === carton.itemId);
    if (!line) {
      line = {
        id: createId('oul'),
        itemId: carton.itemId,
        itemCode: carton.itemCode,
        itemName: carton.itemName,
        quantity: 0,
        barcodes: [],
      };
      lines.push(line);
    }
    line.barcodes = [...line.barcodes, code];
    line.quantity = line.barcodes.length;

    const updated: OutboundHeader = {
      ...doc,
      lines,
      scannedBarcodes: [...doc.scannedBarcodes, code],
      totalCarton: doc.scannedBarcodes.length + 1,
      status: OutboundStatus.Picking,
      updatedAt: nowIso(),
    };

    await db.transaction('rw', db.outbounds, db.cartons, async () => {
      const latestCarton = await db.cartons.where('barcode').equals(code).first();
      if (!latestCarton || latestCarton.status !== CartonStatus.Available) {
        throw new Error(`Barcode ${code} tidak lagi Available.`);
      }
      await db.cartons.put({
        ...latestCarton,
        status: CartonStatus.Reserved,
        reservedDocNo: doc.docNo,
        updatedAt: nowIso(),
      });
      await db.outbounds.put(updated);
    });

    return updated;
  }

  async removeScanned(id: string, barcode: string): Promise<OutboundHeader> {
    const doc = await this.requireEditable(id);
    const code = this.barcodeService.normalize(barcode);
    if (!doc.scannedBarcodes.includes(code)) {
      throw new Error(`Barcode ${code} tidak ada pada dokumen.`);
    }

    const lines = doc.lines
      .map((l) => {
        const barcodes = l.barcodes.filter((b) => b !== code);
        return { ...l, barcodes, quantity: barcodes.length };
      })
      .filter((l) => l.quantity > 0);

    const updated: OutboundHeader = {
      ...doc,
      lines,
      scannedBarcodes: doc.scannedBarcodes.filter((b) => b !== code),
      totalCarton: doc.scannedBarcodes.length - 1,
      status: doc.scannedBarcodes.length - 1 > 0 ? OutboundStatus.Picking : OutboundStatus.Draft,
      updatedAt: nowIso(),
    };

    await db.transaction('rw', db.outbounds, db.cartons, async () => {
      const carton = await db.cartons.where('barcode').equals(code).first();
      if (carton && carton.reservedDocNo === doc.docNo) {
        await db.cartons.put({
          ...carton,
          status: CartonStatus.Available,
          reservedDocNo: undefined,
          updatedAt: nowIso(),
        });
      }
      await db.outbounds.put(updated);
    });

    return updated;
  }

  async confirm(id: string): Promise<OutboundHeader> {
    const doc = await this.storage.getById(id);
    if (!doc) throw new Error('Dokumen outbound tidak ditemukan.');
    if (doc.status === OutboundStatus.Completed) {
      throw new Error('Outbound sudah dikonfirmasi (double posting dicegah).');
    }
    if (doc.status === OutboundStatus.Cancelled) {
      throw new Error('Outbound Cancelled tidak dapat dikonfirmasi.');
    }
    if (!doc.scannedBarcodes.length) {
      throw new Error('Scan minimal satu barcode sebelum konfirmasi.');
    }

    const stamp = nowIso();
    const confirmed: OutboundHeader = {
      ...doc,
      status: OutboundStatus.Completed,
      confirmedAt: stamp,
      updatedAt: stamp,
      totalCarton: doc.scannedBarcodes.length,
    };

    await db.transaction('rw', db.outbounds, db.cartons, db.inventoryTransactions, db.counters, async () => {
      const latest = await db.outbounds.get(id);
      if (!latest || latest.status === OutboundStatus.Completed) {
        throw new Error('Outbound sudah dikonfirmasi.');
      }
      for (const code of doc.scannedBarcodes) {
        const carton = await db.cartons.where('barcode').equals(code).first();
        if (!carton) throw new Error(`Barcode ${code} tidak ditemukan.`);
        if (carton.status !== CartonStatus.Reserved && carton.status !== CartonStatus.Available) {
          throw new Error(`Barcode ${code} berstatus ${carton.status}.`);
        }
        if (carton.warehouseId !== doc.warehouseId) {
          throw new Error(`Barcode ${code} tidak di warehouse dokumen.`);
        }
        await db.cartons.put({
          ...carton,
          status: CartonStatus.Shipped,
          outboundDocNo: doc.docNo,
          reservedDocNo: undefined,
          updatedAt: stamp,
        });
        await db.inventoryTransactions.add({
          id: createId('itx'),
          transactionNumber: await this.docNumbers.nextDocument(DocPrefix.InventoryTxn),
          transactionType: TransactionType.Outbound,
          referenceDocumentId: confirmed.id,
          referenceDocNo: confirmed.docNo,
          cartonId: carton.id,
          barcode: carton.barcode,
          fromWarehouseId: carton.warehouseId,
          fromLocationId: carton.locationId,
          previousStatus: carton.inventoryStatus,
          newStatus: carton.inventoryStatus,
          previousCartonStatus: carton.status,
          newCartonStatus: CartonStatus.Shipped,
          quantity: 1,
          transactionDate: stamp,
          notes: `Outbound ke ${confirmed.customerName || confirmed.customerCode || 'customer'} · dari ${carton.locationCode}`,
          createdBy: confirmed.createdBy,
        });
      }
      await db.outbounds.put(confirmed);
    });

    return confirmed;
  }

  async cancel(id: string): Promise<OutboundHeader> {
    const doc = await this.storage.getById(id);
    if (!doc) throw new Error('Dokumen outbound tidak ditemukan.');
    if (doc.status === OutboundStatus.Completed) {
      throw new Error('Outbound Completed tidak dapat dibatalkan.');
    }

    const updated: OutboundHeader = {
      ...doc,
      status: OutboundStatus.Cancelled,
      updatedAt: nowIso(),
    };

    await db.transaction('rw', db.outbounds, db.cartons, async () => {
      for (const code of doc.scannedBarcodes) {
        const carton = await db.cartons.where('barcode').equals(code).first();
        if (carton && carton.reservedDocNo === doc.docNo) {
          await db.cartons.put({
            ...carton,
            status: CartonStatus.Available,
            reservedDocNo: undefined,
            updatedAt: nowIso(),
          });
        }
      }
      await db.outbounds.put(updated);
    });

    return updated;
  }

  async deleteDraft(id: string): Promise<void> {
    const doc = await this.requireEditable(id);
    if (doc.scannedBarcodes.length) {
      await this.cancel(id);
    }
    const latest = await this.storage.getById(id);
    if (latest && latest.status !== OutboundStatus.Completed) {
      await this.storage.remove(id);
    }
  }

  private async requireEditable(id: string): Promise<OutboundHeader> {
    const doc = await this.storage.getById(id);
    if (!doc) throw new Error('Dokumen outbound tidak ditemukan.');
    if (doc.status === OutboundStatus.Completed || doc.status === OutboundStatus.Cancelled) {
      throw new Error('Dokumen Completed/Cancelled tidak dapat diedit.');
    }
    return doc;
  }
}
