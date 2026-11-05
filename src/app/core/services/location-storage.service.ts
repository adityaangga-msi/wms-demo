import { Injectable } from '@angular/core';
import { db } from '../db/wms-database';
import { MasterStatus } from '../enums';
import { LocationBin } from '../models';
import { nowIso } from '../utils/date.util';
import { createId } from '../utils/id.util';

@Injectable({ providedIn: 'root' })
export class LocationStorageService {
  getAll(): Promise<LocationBin[]> {
    return db.locations.orderBy('locationCode').toArray();
  }

  getActive(): Promise<LocationBin[]> {
    return db.locations.where('status').equals(MasterStatus.Active).sortBy('locationCode');
  }

  getByWarehouse(warehouseId: string): Promise<LocationBin[]> {
    return db.locations.where('warehouseId').equals(warehouseId).sortBy('locationCode');
  }

  getById(id: string): Promise<LocationBin | undefined> {
    return db.locations.get(id);
  }

  getByCode(code: string): Promise<LocationBin | undefined> {
    return db.locations.where('locationCode').equals(code).first();
  }

  async create(input: Omit<LocationBin, 'id' | 'createdAt' | 'updatedAt'>): Promise<LocationBin> {
    const existing = await this.getByCode(input.locationCode);
    if (existing) throw new Error(`Location code ${input.locationCode} sudah digunakan.`);
    const stamp = nowIso();
    const row: LocationBin = { ...input, id: createId('loc'), createdAt: stamp, updatedAt: stamp };
    await db.locations.add(row);
    return row;
  }

  async update(id: string, patch: Partial<LocationBin>): Promise<LocationBin> {
    const current = await this.getById(id);
    if (!current) throw new Error('Location tidak ditemukan.');
    if (patch.locationCode && patch.locationCode !== current.locationCode) {
      const clash = await this.getByCode(patch.locationCode);
      if (clash) throw new Error(`Location code ${patch.locationCode} sudah digunakan.`);
    }
    const updated: LocationBin = { ...current, ...patch, id, updatedAt: nowIso() };
    await db.locations.put(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await db.locations.delete(id);
  }

  async clear(): Promise<void> {
    await db.locations.clear();
  }
}
