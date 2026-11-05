import { Injectable, inject } from '@angular/core';
import {
  ChartPoint,
  DashboardKpi,
  LowStockAlert,
  RecentTransaction,
} from '../models';
import {
  CartonStatus,
  InboundStatus,
  InventoryStatus,
  MovementStatus,
  OutboundStatus,
  TransactionType,
} from '../enums';
import { isSameDay } from '../utils/date.util';
import { ItemStorageService } from './item-storage.service';
import { WarehouseStorageService } from './warehouse-storage.service';
import { BarcodeStorageService } from './barcode-storage.service';
import { InboundStorageService } from './inbound-storage.service';
import { OutboundStorageService } from './outbound-storage.service';
import { MovementStorageService } from './movement-storage.service';
import { InventoryStorageService } from './inventory-storage.service';
import { QiService } from './qi.service';
import { SupplierStorageService } from './supplier-storage.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly items = inject(ItemStorageService);
  private readonly warehouses = inject(WarehouseStorageService);
  private readonly cartons = inject(BarcodeStorageService);
  private readonly inbounds = inject(InboundStorageService);
  private readonly outbounds = inject(OutboundStorageService);
  private readonly movements = inject(MovementStorageService);
  private readonly inventory = inject(InventoryStorageService);
  private readonly qi = inject(QiService);
  private readonly suppliers = inject(SupplierStorageService);

  async getKpis(): Promise<DashboardKpi> {
    const [items, warehouses, cartons, inbounds, outbounds, movements, qiHeaders, suppliers] =
      await Promise.all([
        this.items.getAll(),
        this.warehouses.getAll(),
        this.cartons.getAll(),
        this.inbounds.getAll(),
        this.outbounds.getAll(),
        this.movements.getAll(),
        this.qi.list(),
        this.suppliers.getAll(),
      ]);

    const onHand = cartons.filter(
      (c) =>
        c.status !== CartonStatus.Shipped &&
        c.status !== CartonStatus.Inactive &&
        c.inventoryStatus !== InventoryStatus.Returned &&
        c.inventoryStatus !== InventoryStatus.Scrapped,
    );
    const available = cartons.filter(
      (c) =>
        c.status === CartonStatus.Available &&
        (c.inventoryStatus ?? InventoryStatus.UU) === InventoryStatus.UU,
    );

    const invOf = (s: InventoryStatus) =>
      cartons.filter((c) => (c.inventoryStatus ?? InventoryStatus.UU) === s).length;

    const qiAwaiting = invOf(InventoryStatus.QiPending);
    const qiPassed = qiHeaders.reduce((s, h) => s + h.passedCarton, 0);
    const qiRejected = qiHeaders.reduce((s, h) => s + h.failedCarton, 0);
    const qiInspected = qiPassed + qiRejected;

    const inboundCompleted = inbounds.filter((d) => d.status === InboundStatus.Completed);
    const inboundQiCarton = inboundCompleted
      .filter((d) => d.inspectionType === 'QI')
      .reduce((s, d) => s + d.totalCarton, 0);
    const inboundUuCarton = inboundCompleted
      .filter((d) => (d.inspectionType ?? 'UU') === 'UU')
      .reduce((s, d) => s + d.totalCarton, 0);

    return {
      totalItem: items.length,
      totalWarehouse: warehouses.length,
      totalInventory: onHand.length,
      totalAvailable: available.length,
      inboundToday: inboundCompleted
        .filter((d) => isSameDay(d.confirmedAt ?? d.inboundDate))
        .reduce((s, d) => s + d.totalCarton, 0),
      outboundToday: outbounds
        .filter(
          (d) =>
            d.status === OutboundStatus.Completed && isSameDay(d.confirmedAt ?? d.outboundDate),
        )
        .reduce((s, d) => s + d.totalCarton, 0),
      movementToday: movements
        .filter(
          (d) =>
            d.status === MovementStatus.Completed && isSameDay(d.confirmedAt ?? d.movementDate),
        )
        .reduce((s, d) => s + d.totalCarton, 0),
      inboundCartonTotal: inboundCompleted.reduce((s, d) => s + d.totalCarton, 0),
      inboundQiCarton,
      inboundUuCarton,
      totalSupplier: suppliers.length,
      qiAwaiting,
      qiInspected,
      qiPassed,
      qiRejected,
      qiQuarantine: invOf(InventoryStatus.Quarantine),
      qiBlocked: invOf(InventoryStatus.Blocked),
      qiReturn: invOf(InventoryStatus.ReturnPending) + invOf(InventoryStatus.Returned),
      qiScrap: invOf(InventoryStatus.ScrapPending) + invOf(InventoryStatus.Scrapped),
      qiPassRate: qiInspected ? Math.round((qiPassed / qiInspected) * 1000) / 10 : 0,
      qiRejectRate: qiInspected ? Math.round((qiRejected / qiInspected) * 1000) / 10 : 0,
      outboundCartonTotal: outbounds
        .filter((d) => d.status === OutboundStatus.Completed)
        .reduce((s, d) => s + d.totalCarton, 0),
      outboundDocTotal: outbounds.filter((d) => d.status === OutboundStatus.Completed).length,
      invUu: invOf(InventoryStatus.UU),
      invQiPending: qiAwaiting,
      invQuarantine: invOf(InventoryStatus.Quarantine),
      invBlocked: invOf(InventoryStatus.Blocked),
      invReturnPending: invOf(InventoryStatus.ReturnPending),
      invScrapPending: invOf(InventoryStatus.ScrapPending),
    };
  }

  async getInboundVsOutbound(days = 7): Promise<{ labels: string[]; inbound: number[]; outbound: number[] }> {
    const [inbounds, outbounds] = await Promise.all([this.inbounds.getAll(), this.outbounds.getAll()]);
    const labels: string[] = [];
    const inbound: number[] = [];
    const outbound: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
      inbound.push(
        inbounds
          .filter((x) => x.status === InboundStatus.Completed && isSameDay(x.confirmedAt ?? x.inboundDate, d))
          .reduce((s, x) => s + x.totalCarton, 0),
      );
      outbound.push(
        outbounds
          .filter((x) => x.status === OutboundStatus.Completed && isSameDay(x.confirmedAt ?? x.outboundDate, d))
          .reduce((s, x) => s + x.totalCarton, 0),
      );
    }
    return { labels, inbound, outbound };
  }

  async getQiPassReject(): Promise<ChartPoint[]> {
    const headers = await this.qi.list();
    const passed = headers.reduce((s, h) => s + h.passedCarton, 0);
    const failed = headers.reduce((s, h) => s + h.failedCarton, 0);
    return [
      { label: 'Passed', value: passed },
      { label: 'Rejected', value: failed },
    ];
  }

  async getInventoryStatusDistribution(): Promise<ChartPoint[]> {
    const cartons = await this.cartons.getAll();
    const map = new Map<string, number>();
    for (const c of cartons) {
      if (c.status === CartonStatus.Shipped) continue;
      const key = c.inventoryStatus ?? InventoryStatus.UU;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([label, value]) => ({ label, value }));
  }

  async getInventoryByWarehouse(): Promise<ChartPoint[]> {
    const cartons = await this.cartons.getAll();
    const map = new Map<string, number>();
    for (const c of cartons) {
      if (c.status === CartonStatus.Shipped || c.status === CartonStatus.Inactive) continue;
      if (
        c.inventoryStatus === InventoryStatus.Returned ||
        c.inventoryStatus === InventoryStatus.Scrapped
      ) {
        continue;
      }
      map.set(c.warehouseCode, (map.get(c.warehouseCode) ?? 0) + 1);
    }
    return [...map.entries()].map(([label, value]) => ({ label, value }));
  }

  async getInventoryByCategory(): Promise<ChartPoint[]> {
    const [summary, items] = await Promise.all([this.inventory.getSummary(), this.items.getAll()]);
    const catMap = new Map(items.map((i) => [i.id, i.category]));
    const map = new Map<string, number>();
    for (const row of summary) {
      const cat = catMap.get(row.itemId) ?? row.category ?? 'Lainnya';
      map.set(cat, (map.get(cat) ?? 0) + row.availableCarton);
    }
    return [...map.entries()].map(([label, value]) => ({ label, value }));
  }

  async getRecentTransactions(limit = 8): Promise<RecentTransaction[]> {
    const [inbounds, outbounds, movements, qiHeaders] = await Promise.all([
      this.inbounds.getAll(),
      this.outbounds.getAll(),
      this.movements.getAll(),
      this.qi.list(),
    ]);
    const rows: RecentTransaction[] = [
      ...inbounds.map((d) => ({
        docNo: d.docNo,
        type: TransactionType.Inbound,
        date: d.confirmedAt ?? d.createdAt,
        totalCarton: d.totalCarton,
        status: d.status,
      })),
      ...outbounds.map((d) => ({
        docNo: d.docNo,
        type: TransactionType.Outbound,
        date: d.confirmedAt ?? d.createdAt,
        totalCarton: d.totalCarton,
        status: d.status,
      })),
      ...movements.map((d) => ({
        docNo: d.docNo,
        type: TransactionType.Adjustment,
        date: d.confirmedAt ?? d.createdAt,
        totalCarton: d.totalCarton,
        status: d.status,
      })),
      ...qiHeaders.map((d) => ({
        docNo: d.docNo,
        type: TransactionType.QualityInspection,
        date: d.completedAt ?? d.updatedAt,
        totalCarton: d.totalCarton,
        status: d.status,
      })),
    ];
    return rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  }

  async getLowStockAlerts(threshold = 3): Promise<LowStockAlert[]> {
    const summary = await this.inventory.getSummary();
    const map = new Map<string, LowStockAlert>();
    for (const row of summary) {
      const key = `${row.itemId}|${row.warehouseId}`;
      const prev = map.get(key);
      const available = (prev?.availableCarton ?? 0) + row.availableCarton;
      map.set(key, {
        itemCode: row.itemCode,
        itemName: row.itemName,
        warehouseCode: row.warehouseCode,
        availableCarton: available,
      });
    }
    return [...map.values()].filter((a) => a.availableCarton <= threshold).slice(0, 20);
  }

  async getTopRejectedItems(limit = 10): Promise<ChartPoint[]> {
    const headers = await this.qi.list();
    const map = new Map<string, number>();
    for (const h of headers) {
      for (const d of h.details) {
        if (d.inspectionStatus === 'Failed' || d.inspectionStatus === 'Hold') {
          map.set(d.itemCode, (map.get(d.itemCode) ?? 0) + 1);
        }
      }
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }
}
