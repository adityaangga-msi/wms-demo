import { Injectable } from '@angular/core';
import { db } from '../db/wms-database';
import { MasterStatus } from '../enums';
import { Item } from '../models';
import { nowIso } from '../utils/date.util';
import { createId } from '../utils/id.util';

@Injectable({ providedIn: 'root' })
export class ItemStorageService {
  getAll(): Promise<Item[]> {
    return db.items.orderBy('itemCode').toArray();
  }

  getActive(): Promise<Item[]> {
    return db.items.where('status').equals(MasterStatus.Active).sortBy('itemCode');
  }

  getById(id: string): Promise<Item | undefined> {
    return db.items.get(id);
  }

  getByCode(itemCode: string): Promise<Item | undefined> {
    return db.items.where('itemCode').equals(itemCode).first();
  }

  async create(input: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'uom'> & { uom?: 'Karton' }): Promise<Item> {
    const existing = await this.getByCode(input.itemCode);
    if (existing) throw new Error(`Item code ${input.itemCode} sudah digunakan.`);
    const stamp = nowIso();
    const item: Item = {
      ...input,
      id: createId('itm'),
      uom: 'Karton',
      createdAt: stamp,
      updatedAt: stamp,
    };
    await db.items.add(item);
    return item;
  }

  async update(id: string, patch: Partial<Item>): Promise<Item> {
    const current = await this.getById(id);
    if (!current) throw new Error('Item tidak ditemukan.');
    if (patch.itemCode && patch.itemCode !== current.itemCode) {
      const clash = await this.getByCode(patch.itemCode);
      if (clash) throw new Error(`Item code ${patch.itemCode} sudah digunakan.`);
    }
    const updated: Item = { ...current, ...patch, id, uom: 'Karton', updatedAt: nowIso() };
    await db.items.put(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await db.items.delete(id);
  }

  async clear(): Promise<void> {
    await db.items.clear();
  }
}
