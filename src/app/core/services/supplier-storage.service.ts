import { Injectable } from '@angular/core';
import { db } from '../db/wms-database';
import { MasterStatus } from '../enums';
import { Supplier } from '../models';
import { nowIso } from '../utils/date.util';
import { createId } from '../utils/id.util';

@Injectable({ providedIn: 'root' })
export class SupplierStorageService {
  getAll(): Promise<Supplier[]> {
    return db.suppliers.orderBy('supplierCode').toArray();
  }

  getActive(): Promise<Supplier[]> {
    return db.suppliers.where('status').equals(MasterStatus.Active).sortBy('supplierCode');
  }

  getById(id: string): Promise<Supplier | undefined> {
    return db.suppliers.get(id);
  }

  getByCode(code: string): Promise<Supplier | undefined> {
    return db.suppliers.where('supplierCode').equals(code).first();
  }

  async create(input: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> {
    const existing = await this.getByCode(input.supplierCode);
    if (existing) throw new Error(`Supplier code ${input.supplierCode} sudah digunakan.`);
    const stamp = nowIso();
    const row: Supplier = { ...input, id: createId('sup'), createdAt: stamp, updatedAt: stamp };
    await db.suppliers.add(row);
    return row;
  }

  async update(id: string, patch: Partial<Supplier>): Promise<Supplier> {
    const current = await this.getById(id);
    if (!current) throw new Error('Supplier tidak ditemukan.');
    if (patch.supplierCode && patch.supplierCode !== current.supplierCode) {
      const clash = await this.getByCode(patch.supplierCode);
      if (clash) throw new Error(`Supplier code ${patch.supplierCode} sudah digunakan.`);
    }
    const updated: Supplier = { ...current, ...patch, id, updatedAt: nowIso() };
    await db.suppliers.put(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await db.suppliers.delete(id);
  }

  async clear(): Promise<void> {
    await db.suppliers.clear();
  }
}
