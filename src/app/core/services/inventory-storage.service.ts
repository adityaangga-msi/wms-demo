import { Injectable, inject } from '@angular/core';
import { CartonStatus } from '../enums';
import { CartonBarcode, InventorySummaryRow } from '../models';
import { itemContentUom, itemQtyPerCarton } from '../utils/item-content.util';
import { BarcodeStorageService } from './barcode-storage.service';
import { ItemStorageService } from './item-storage.service';
import { db } from '../db/wms-database';

@Injectable({ providedIn: 'root' })
export class InventoryStorageService {
  private readonly barcodes = inject(BarcodeStorageService);
  private readonly items = inject(ItemStorageService);

  async getDetail(filters?: {
    barcode?: string;
    itemCode?: string;
    itemName?: string;
    warehouseId?: string;
    locationId?: string;
    status?: CartonStatus;
  }): Promise<CartonBarcode[]> {
    let rows = await this.barcodes.getAll();
    if (filters?.barcode) {
      const q = filters.barcode.trim().toLowerCase();
      rows = rows.filter((r) => r.barcode.toLowerCase().includes(q));
    }
    if (filters?.itemCode) {
      const q = filters.itemCode.trim().toLowerCase();
      rows = rows.filter((r) => r.itemCode.toLowerCase().includes(q));
    }
    if (filters?.itemName) {
      const q = filters.itemName.trim().toLowerCase();
      rows = rows.filter((r) => r.itemName.toLowerCase().includes(q));
    }
    if (filters?.warehouseId) {
      rows = rows.filter((r) => r.warehouseId === filters.warehouseId);
    }
    if (filters?.locationId) {
      rows = rows.filter((r) => r.locationId === filters.locationId);
    }
    if (filters?.status) {
      rows = rows.filter((r) => r.status === filters.status);
    }
    return rows.sort((a, b) => a.barcode.localeCompare(b.barcode));
  }

  async getSummary(): Promise<InventorySummaryRow[]> {
    const [cartons, items, inbounds, outbounds] = await Promise.all([
      this.barcodes.getAll(),
      this.items.getAll(),
      db.inbounds.toArray(),
      db.outbounds.toArray(),
    ]);

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const inboundByItemLoc = new Map<string, number>();
    for (const doc of inbounds.filter((d) => d.status === 'Completed')) {
      for (const line of doc.lines) {
        const key = `${line.itemId}|${doc.warehouseId}|${line.locationId}`;
        inboundByItemLoc.set(key, (inboundByItemLoc.get(key) ?? 0) + line.quantity);
      }
    }
    const outboundByItemWh = new Map<string, number>();
    for (const doc of outbounds.filter((d) => d.status === 'Completed')) {
      for (const line of doc.lines) {
        const key = `${line.itemId}|${doc.warehouseId}`;
        outboundByItemWh.set(key, (outboundByItemWh.get(key) ?? 0) + line.quantity);
      }
    }

    const map = new Map<string, InventorySummaryRow>();
    for (const c of cartons) {
      if (c.status === CartonStatus.Shipped || c.status === CartonStatus.Inactive) continue;
      const key = `${c.itemId}|${c.warehouseId}|${c.locationId}`;
      let row = map.get(key);
      if (!row) {
        const item = itemMap.get(c.itemId);
        const per = itemQtyPerCarton(item);
        const contentUom = itemContentUom(item);
        row = {
          itemId: c.itemId,
          itemCode: c.itemCode,
          itemName: c.itemName,
          category: item?.category,
          warehouseId: c.warehouseId,
          warehouseCode: c.warehouseCode,
          locationId: c.locationId,
          locationCode: c.locationCode,
          totalCarton: 0,
          availableCarton: 0,
          reservedCarton: 0,
          inboundCarton: inboundByItemLoc.get(`${c.itemId}|${c.warehouseId}|${c.locationId}`) ?? 0,
          outboundCarton: outboundByItemWh.get(`${c.itemId}|${c.warehouseId}`) ?? 0,
          qtyPerCarton: per,
          contentUom,
          totalContent: 0,
          availableContent: 0,
        };
        map.set(key, row);
      }
      row.totalCarton += 1;
      if (c.status === CartonStatus.Available) row.availableCarton += 1;
      if (c.status === CartonStatus.Reserved || c.status === CartonStatus.Picked || c.status === CartonStatus.InTransit) {
        row.reservedCarton += 1;
      }
    }

    const rows = [...map.values()].map((r) => ({
      ...r,
      totalContent: r.totalCarton * r.qtyPerCarton,
      availableContent: r.availableCarton * r.qtyPerCarton,
    }));

    return rows.sort((a, b) =>
      `${a.itemCode}${a.warehouseCode}${a.locationCode}`.localeCompare(
        `${b.itemCode}${b.warehouseCode}${b.locationCode}`,
      ),
    );
  }

  async countByStatus(): Promise<Record<string, number>> {
    const cartons = await this.barcodes.getAll();
    const result: Record<string, number> = {};
    for (const c of cartons) {
      result[c.status] = (result[c.status] ?? 0) + 1;
    }
    return result;
  }
}
