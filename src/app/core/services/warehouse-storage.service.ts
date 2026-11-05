import { Injectable } from '@angular/core';
import { db } from '../db/wms-database';
import { MasterStatus } from '../enums';
import { Warehouse } from '../models';
import { nowIso } from '../utils/date.util';
import { createId } from '../utils/id.util';

@Injectable({ providedIn: 'root' })
export class WarehouseStorageService {
  getAll(): Promise<Warehouse[]> {
    return db.warehouses.orderBy('warehouseCode').toArray();
  }

  getActive(): Promise<Warehouse[]> {
    return db.warehouses.where('status').equals(MasterStatus.Active).sortBy('warehouseCode');
  }

  getById(id: string): Promise<Warehouse | undefined> {
    return db.warehouses.get(id);
  }

  getByCode(code: string): Promise<Warehouse | undefined> {
    return db.warehouses.where('warehouseCode').equals(code).first();
  }

  async create(
    input: Omit<Warehouse, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Warehouse> {
    const existing = await this.getByCode(input.warehouseCode);
    if (existing) throw new Error(`Warehouse code ${input.warehouseCode} sudah digunakan.`);
    const stamp = nowIso();
    const row: Warehouse = { ...input, id: createId('wh'), createdAt: stamp, updatedAt: stamp };
    await db.warehouses.add(row);
    return row;
  }

  async update(id: string, patch: Partial<Warehouse>): Promise<Warehouse> {
    const current = await this.getById(id);
    if (!current) throw new Error('Warehouse tidak ditemukan.');
    if (patch.warehouseCode && patch.warehouseCode !== current.warehouseCode) {
      const clash = await this.getByCode(patch.warehouseCode);
      if (clash) throw new Error(`Warehouse code ${patch.warehouseCode} sudah digunakan.`);
    }
    const updated: Warehouse = { ...current, ...patch, id, updatedAt: nowIso() };
    await db.warehouses.put(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await db.warehouses.delete(id);
  }

  async clear(): Promise<void> {
    await db.warehouses.clear();
  }
}
