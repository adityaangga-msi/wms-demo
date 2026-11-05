import { Injectable } from '@angular/core';
import { db } from '../db/wms-database';
import { MasterStatus } from '../enums';
import { Customer } from '../models';
import { nowIso } from '../utils/date.util';
import { createId } from '../utils/id.util';

@Injectable({ providedIn: 'root' })
export class CustomerStorageService {
  getAll(): Promise<Customer[]> {
    return db.customers.orderBy('customerCode').toArray();
  }

  getActive(): Promise<Customer[]> {
    return db.customers.where('status').equals(MasterStatus.Active).sortBy('customerCode');
  }

  getById(id: string): Promise<Customer | undefined> {
    return db.customers.get(id);
  }

  getByCode(code: string): Promise<Customer | undefined> {
    return db.customers.where('customerCode').equals(code).first();
  }

  async create(input: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const existing = await this.getByCode(input.customerCode);
    if (existing) throw new Error(`Customer code ${input.customerCode} sudah digunakan.`);
    const stamp = nowIso();
    const row: Customer = { ...input, id: createId('cus'), createdAt: stamp, updatedAt: stamp };
    await db.customers.add(row);
    return row;
  }

  async update(id: string, patch: Partial<Customer>): Promise<Customer> {
    const current = await this.getById(id);
    if (!current) throw new Error('Customer tidak ditemukan.');
    if (patch.customerCode && patch.customerCode !== current.customerCode) {
      const clash = await this.getByCode(patch.customerCode);
      if (clash) throw new Error(`Customer code ${patch.customerCode} sudah digunakan.`);
    }
    const updated: Customer = { ...current, ...patch, id, updatedAt: nowIso() };
    await db.customers.put(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await db.customers.delete(id);
  }

  async clear(): Promise<void> {
    await db.customers.clear();
  }
}
