import { Injectable } from '@angular/core';
import { db } from '../db/wms-database';
import { CartonStatus } from '../enums';
import { CartonBarcode } from '../models';

@Injectable({ providedIn: 'root' })
export class BarcodeStorageService {
  getAll(): Promise<CartonBarcode[]> {
    return db.cartons.orderBy('barcode').toArray();
  }

  getByBarcode(barcode: string): Promise<CartonBarcode | undefined> {
    return db.cartons.where('barcode').equals(barcode.trim().toUpperCase()).first();
  }

  getById(id: string): Promise<CartonBarcode | undefined> {
    return db.cartons.get(id);
  }

  getByStatus(status: CartonStatus): Promise<CartonBarcode[]> {
    return db.cartons.where('status').equals(status).toArray();
  }

  getAvailableByWarehouse(warehouseId: string): Promise<CartonBarcode[]> {
    return db.cartons
      .where({ warehouseId, status: CartonStatus.Available })
      .toArray();
  }

  getByLocation(locationId: string): Promise<CartonBarcode[]> {
    return db.cartons.where('locationId').equals(locationId).toArray();
  }

  getByWarehouse(warehouseId: string): Promise<CartonBarcode[]> {
    return db.cartons.where('warehouseId').equals(warehouseId).toArray();
  }

  search(term: string): Promise<CartonBarcode[]> {
    const q = term.trim().toLowerCase();
    if (!q) return this.getAll();
    return db.cartons
      .filter(
        (c) =>
          c.barcode.toLowerCase().includes(q) ||
          c.itemCode.toLowerCase().includes(q) ||
          c.itemName.toLowerCase().includes(q) ||
          c.warehouseCode.toLowerCase().includes(q) ||
          c.locationCode.toLowerCase().includes(q),
      )
      .toArray();
  }

  async bulkAdd(rows: CartonBarcode[]): Promise<void> {
    await db.cartons.bulkAdd(rows);
  }

  async put(row: CartonBarcode): Promise<void> {
    await db.cartons.put(row);
  }

  async bulkPut(rows: CartonBarcode[]): Promise<void> {
    await db.cartons.bulkPut(rows);
  }

  async clear(): Promise<void> {
    await db.cartons.clear();
  }

  count(): Promise<number> {
    return db.cartons.count();
  }
}
