import { Injectable } from '@angular/core';
import { db } from '../db/wms-database';
import { MasterStatus } from '../enums';
import { WarehouseFloor } from '../models';
import { nowIso } from '../utils/date.util';
import { createId } from '../utils/id.util';

@Injectable({ providedIn: 'root' })
export class WarehouseFloorService {
  getAll(): Promise<WarehouseFloor[]> {
    return db.warehouseFloors.orderBy('sortOrder').toArray();
  }

  getByWarehouse(warehouseId: string): Promise<WarehouseFloor[]> {
    return db.warehouseFloors.where('warehouseId').equals(warehouseId).sortBy('sortOrder');
  }

  getById(id: string): Promise<WarehouseFloor | undefined> {
    return db.warehouseFloors.get(id);
  }

  async create(input: {
    warehouseId: string;
    warehouseCode: string;
    floorCode: string;
    floorName: string;
    sortOrder?: number;
    cols?: number;
    rows?: number;
  }): Promise<WarehouseFloor> {
    const code = input.floorCode.trim().toUpperCase();
    if (!code) throw new Error('Kode lantai wajib.');
    const existing = await db.warehouseFloors
      .where('warehouseId')
      .equals(input.warehouseId)
      .filter((f) => f.floorCode.toUpperCase() === code)
      .first();
    if (existing) throw new Error(`Lantai ${code} sudah ada di warehouse ini.`);

    const siblings = await this.getByWarehouse(input.warehouseId);
    const stamp = nowIso();
    const row: WarehouseFloor = {
      id: createId('wfl'),
      warehouseId: input.warehouseId,
      warehouseCode: input.warehouseCode,
      floorCode: code,
      floorName: input.floorName.trim() || code,
      sortOrder: input.sortOrder ?? siblings.length + 1,
      cols: input.cols ?? 12,
      rows: input.rows ?? 8,
      status: MasterStatus.Active,
      createdAt: stamp,
      updatedAt: stamp,
    };
    await db.warehouseFloors.add(row);
    return row;
  }

  async ensureDefaultFloor(warehouseId: string, warehouseCode: string): Promise<WarehouseFloor> {
    const list = await this.getByWarehouse(warehouseId);
    if (list.length) return list[0];
    return this.create({
      warehouseId,
      warehouseCode,
      floorCode: 'LV.01',
      floorName: 'Lantai 1',
      sortOrder: 1,
    });
  }

  async update(id: string, patch: Partial<WarehouseFloor>): Promise<WarehouseFloor> {
    const current = await this.getById(id);
    if (!current) throw new Error('Lantai tidak ditemukan.');
    const updated: WarehouseFloor = { ...current, ...patch, id, updatedAt: nowIso() };
    await db.warehouseFloors.put(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const locs = await db.locations.where('floorId').equals(id).count();
    if (locs > 0) throw new Error('Lantai masih punya bin. Pindahkan/hapus bin dulu.');
    await db.warehouseFloors.delete(id);
  }
}
