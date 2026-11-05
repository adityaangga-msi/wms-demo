import { Injectable, inject } from '@angular/core';
import { db } from '../db/wms-database';
import {
  AdjustmentKind,
  CartonQcStatus,
  CartonStatus,
  InboundStatus,
  InventoryStatus,
  LocationType,
  MasterStatus,
  MovementStatus,
  OutboundStatus,
} from '../enums';
import {
  AppMeta,
  CartonBarcode,
  Customer,
  DemoExportPayload,
  InboundHeader,
  Item,
  LocationBin,
  MovementHeader,
  OutboundHeader,
  Supplier,
  Warehouse,
  WarehouseFloor,
} from '../models';
import { nowIso } from '../utils/date.util';
import { createId, padSequence } from '../utils/id.util';
import { DocumentNumberService } from './document-number.service';

const SEED_VERSION = 5;
const META_ID = 'app-meta';

@Injectable({ providedIn: 'root' })
export class DemoDataService {
  private readonly docNumbers = inject(DocumentNumberService);

  async ensureSeeded(): Promise<void> {
    const meta = await db.meta.get(META_ID);
    const itemCount = await db.items.count();
    if (!meta?.seeded || itemCount === 0 || (meta.seedVersion ?? 0) < SEED_VERSION) {
      await this.loadSampleData(true);
    }
  }

  async loadSampleData(forceClear = false): Promise<void> {
    if (forceClear) {
      await this.clearAllTables();
    } else {
      const count = await db.items.count();
      if (count > 0) throw new Error('Data sudah ada. Gunakan Reset Demo Data terlebih dahulu.');
    }

    const stamp = nowIso();
    const items: Item[] = [
      {
        id: createId('itm'),
        itemCode: 'ITEM001',
        itemName: 'Product A',
        category: 'Dairy Drink',
        description: 'Product A 500 ML',
        uom: 'Karton',
        qtyPerCarton: 12,
        contentUom: 'Pcs',
        barcodeConfig: 'CTN',
        status: MasterStatus.Active,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: createId('itm'),
        itemCode: 'ITEM002',
        itemName: 'Product B',
        category: 'Yogurt',
        description: 'Product B 250 ML',
        uom: 'Karton',
        qtyPerCarton: 24,
        contentUom: 'Pcs',
        barcodeConfig: 'CTN',
        status: MasterStatus.Active,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: createId('itm'),
        itemCode: 'ITEM003',
        itemName: 'Product C',
        category: 'Milk',
        description: 'Product C 1 L',
        uom: 'Karton',
        qtyPerCarton: 6,
        contentUom: 'Liter',
        barcodeConfig: 'CTN',
        status: MasterStatus.Active,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ];

    const warehouses: Warehouse[] = [
      {
        id: createId('wh'),
        warehouseCode: 'WH01',
        warehouseName: 'Main Warehouse',
        address: 'Jl. Industri No. 1, Jakarta',
        description: 'Gudang utama',
        status: MasterStatus.Active,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: createId('wh'),
        warehouseCode: 'WH02',
        warehouseName: 'Secondary Warehouse',
        address: 'Jl. Logistik No. 2, Bekasi',
        description: 'Gudang sekunder',
        status: MasterStatus.Active,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ];

    const [wh01, wh02] = warehouses;
    const floors: WarehouseFloor[] = [
      this.floor(wh01, 'LV.01', 'Receiving & Storage', 1, stamp, 12, 10),
      this.floor(wh01, 'LV.02', 'QI & Special Areas', 2, stamp, 10, 8),
      this.floor(wh02, 'LV.01', 'Main Floor', 1, stamp, 10, 8),
    ];
    const [fWh01L1, fWh01L2, fWh02L1] = floors;

    const locations: LocationBin[] = [
      this.loc('WH01-R01-B01', 'Rack 1 Bin 1', wh01, LocationType.Bin, stamp, 50, 'A', 'A01', '01', fWh01L1, 0, 0),
      this.loc('WH01-R01-B02', 'Rack 1 Bin 2', wh01, LocationType.Bin, stamp, 50, 'A', 'A01', '02', fWh01L1, 2, 0),
      this.loc('WH01-R02-B01', 'Rack 2 Bin 1', wh01, LocationType.Bin, stamp, 50, 'A', 'A02', '01', fWh01L1, 4, 0),
      this.loc('WH01-STG-01', 'Staging Area', wh01, LocationType.Staging, stamp, 100, 'STG', 'STG', '01', fWh01L1, 0, 3, 4, 2),
      this.loc('WH02-R01-B01', 'Rack 1 Bin 1', wh02, LocationType.Bin, stamp, 50, 'A', 'A01', '01', fWh02L1, 0, 0),
      this.loc('WH01-QI-01', 'QI Area 01', wh01, LocationType.QiArea, stamp, 80, 'QI', 'QI', '01', fWh01L2, 0, 0, 3, 2),
      this.loc('WH01-QUA-01', 'Quarantine Area', wh01, LocationType.Quarantine, stamp, 40, 'QUA', 'QUA', '01', fWh01L2, 3, 0, 3, 2),
      this.loc('WH01-BLK-01', 'Blocked Area', wh01, LocationType.BlockedArea, stamp, 40, 'BLK', 'BLK', '01', fWh01L2, 6, 0, 2, 2),
      this.loc('WH01-RET-01', 'Return Area', wh01, LocationType.ReturnArea, stamp, 40, 'RET', 'RET', '01', fWh01L2, 0, 3, 3, 2),
      this.loc('WH01-SCR-01', 'Scrap Area', wh01, LocationType.ScrapArea, stamp, 40, 'SCR', 'SCR', '01', fWh01L2, 3, 3, 3, 2),
    ];

    const suppliers: Supplier[] = [
      {
        id: createId('sup'),
        supplierCode: 'SUP001',
        supplierName: 'Supplier A',
        address: 'Jl. Supplier A',
        contact: '021-111-0001',
        status: MasterStatus.Active,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: createId('sup'),
        supplierCode: 'SUP002',
        supplierName: 'Supplier B',
        address: 'Jl. Supplier B',
        contact: '021-111-0002',
        status: MasterStatus.Active,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ];

    const customers: Customer[] = [
      {
        id: createId('cus'),
        customerCode: 'CUS001',
        customerName: 'Customer A',
        address: 'Jl. Customer A',
        contact: '021-222-0001',
        status: MasterStatus.Active,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: createId('cus'),
        customerCode: 'CUS002',
        customerName: 'Customer B',
        address: 'Jl. Customer B',
        contact: '021-222-0002',
        status: MasterStatus.Active,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ];

    // Create cartons: 10 ITEM001, 8 ITEM002, 6 ITEM003 at WH01; 4 ITEM001 at WH02
    let seq = 0;
    const makeCodes = (n: number) =>
      Array.from({ length: n }, () => {
        seq += 1;
        return `CTN${padSequence(seq, 6)}`;
      });

    const codesA = makeCodes(10);
    const codesB = makeCodes(8);
    const codesC = makeCodes(6);
    const codesA2 = makeCodes(4);

    const inbound1 = this.buildInbound(
      'INB-SEED-0001',
      suppliers[0],
      wh01,
      [
        { item: items[0], qty: 10, loc: locations[0], barcodes: codesA },
        { item: items[1], qty: 8, loc: locations[1], barcodes: codesB },
        { item: items[2], qty: 6, loc: locations[2], barcodes: codesC },
      ],
      stamp,
    );
    const wh02Loc = locations.find((l) => l.warehouseId === wh02.id)!;
    const inbound2 = this.buildInbound(
      'INB-SEED-0002',
      suppliers[1],
      wh02,
      [{ item: items[0], qty: 4, loc: wh02Loc, barcodes: codesA2 }],
      stamp,
    );

    const cartons: CartonBarcode[] = [];
    for (const doc of [inbound1, inbound2]) {
      for (const line of doc.lines) {
        for (const code of line.barcodes) {
          cartons.push({
            id: createId('ctn'),
            barcode: code,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            inboundId: doc.id,
            inboundDocNo: doc.docNo,
            inboundLineId: line.id,
            warehouseId: doc.warehouseId,
            warehouseCode: doc.warehouseCode,
            locationId: line.locationId,
            locationCode: line.locationCode,
            receivingDate: doc.inboundDate,
            status: CartonStatus.Available,
            inventoryStatus: InventoryStatus.UU,
            qcStatus: CartonQcStatus.UU,
            batchNo: line.batchNo,
            expiredDate: line.expiredDate,
            uuDate: line.uuDate ?? stamp.slice(0, 10),
            createdAt: stamp,
            updatedAt: stamp,
          });
        }
      }
    }

    // Outbound 3 cartons of ITEM001 from WH01
    const shipCodes = codesA.slice(0, 3);
    for (const code of shipCodes) {
      const c = cartons.find((x) => x.barcode === code)!;
      c.status = CartonStatus.Shipped;
      c.outboundDocNo = 'OUT-SEED-0001';
      c.updatedAt = stamp;
    }
    const outbound1: OutboundHeader = {
      id: createId('out'),
      docNo: 'OUT-SEED-0001',
      customerId: customers[0].id,
      customerCode: customers[0].customerCode,
      customerName: customers[0].customerName,
      warehouseId: wh01.id,
      warehouseCode: wh01.warehouseCode,
      outboundDate: stamp,
      status: OutboundStatus.Completed,
      notes: 'Sample outbound',
      totalCarton: 3,
      lines: [
        {
          id: createId('oul'),
          itemId: items[0].id,
          itemCode: items[0].itemCode,
          itemName: items[0].itemName,
          quantity: 3,
          barcodes: shipCodes,
        },
      ],
      scannedBarcodes: shipCodes,
      createdBy: 'Demo User',
      createdAt: stamp,
      updatedAt: stamp,
      confirmedAt: stamp,
    };

    // Adjustment (location) 2 cartons ITEM002 from R01-B02 to R02-B01
    const moveCodes = codesB.slice(0, 2);
    for (const code of moveCodes) {
      const c = cartons.find((x) => x.barcode === code)!;
      c.locationId = locations[2].id;
      c.locationCode = locations[2].locationCode;
      c.lastMovementDate = stamp;
      c.updatedAt = stamp;
    }
    const movement1: MovementHeader = {
      id: createId('adj'),
      docNo: 'ADJ-SEED-0001',
      adjustKind: AdjustmentKind.Location,
      fromWarehouseId: wh01.id,
      fromWarehouseCode: wh01.warehouseCode,
      fromLocationId: locations[1].id,
      fromLocationCode: locations[1].locationCode,
      toWarehouseId: wh01.id,
      toWarehouseCode: wh01.warehouseCode,
      toLocationId: locations[2].id,
      toLocationCode: locations[2].locationCode,
      movementDate: stamp,
      status: MovementStatus.Completed,
      notes: 'Sample adjustment (tempat)',
      totalCarton: 2,
      lines: moveCodes.map((code) => ({
        id: createId('mol'),
        barcode: code,
        itemId: items[1].id,
        itemCode: items[1].itemCode,
        itemName: items[1].itemName,
        fromLocationId: locations[1].id,
        fromLocationCode: locations[1].locationCode,
        quantity: 1,
      })),
      createdBy: 'Demo User',
      createdAt: stamp,
      updatedAt: stamp,
      confirmedAt: stamp,
    };

    const meta: AppMeta = {
      id: META_ID,
      seeded: true,
      seedVersion: SEED_VERSION,
      lastResetAt: stamp,
    };

    await db.transaction(
      'rw',
      [
        db.items,
        db.warehouses,
        db.warehouseFloors,
        db.locations,
        db.suppliers,
        db.customers,
        db.cartons,
        db.inbounds,
        db.outbounds,
        db.movements,
        db.qiHeaders,
        db.qiEvidence,
        db.inventoryTransactions,
        db.statusAdjustments,
        db.meta,
        db.counters,
      ],
      async () => {
        await db.items.bulkAdd(items);
        await db.warehouses.bulkAdd(warehouses);
        await db.warehouseFloors.bulkAdd(floors);
        await db.locations.bulkAdd(locations);
        await db.suppliers.bulkAdd(suppliers);
        await db.customers.bulkAdd(customers);
        await db.cartons.bulkAdd(cartons);
        await db.inbounds.bulkAdd([inbound1, inbound2]);
        await db.outbounds.bulkAdd([outbound1]);
        await db.movements.bulkAdd([movement1]);
        await db.counters.bulkPut([
          { id: 'CTN', key: 'CTN', value: seq },
          { id: `INB-counter`, key: 'INB-seed', value: 2 },
          { id: `OUT-counter`, key: 'OUT-seed', value: 1 },
          { id: `MOV-counter`, key: 'MOV-seed', value: 1 },
          { id: `QI-counter`, key: 'QI-seed', value: 0 },
        ]);
        await db.meta.put(meta);
      },
    );
  }

  async resetDemoData(): Promise<void> {
    await this.loadSampleData(true);
  }

  async exportJson(): Promise<string> {
    const payload: DemoExportPayload = {
      version: SEED_VERSION,
      exportedAt: nowIso(),
      items: await db.items.toArray(),
      warehouses: await db.warehouses.toArray(),
      warehouseFloors: await db.warehouseFloors.toArray(),
      locations: await db.locations.toArray(),
      suppliers: await db.suppliers.toArray(),
      customers: await db.customers.toArray(),
      cartons: await db.cartons.toArray(),
      inbounds: await db.inbounds.toArray(),
      outbounds: await db.outbounds.toArray(),
      movements: await db.movements.toArray(),
      meta: await db.meta.toArray(),
      counters: await db.counters.toArray(),
    };
    return JSON.stringify(payload, null, 2);
  }

  async importJson(json: string): Promise<void> {
    const payload = JSON.parse(json) as DemoExportPayload;
    if (!payload?.items || !payload?.warehouses) {
      throw new Error('Format JSON tidak valid.');
    }
    await this.clearAllTables();
    await db.transaction(
      'rw',
      [
        db.items,
        db.warehouses,
        db.warehouseFloors,
        db.locations,
        db.suppliers,
        db.customers,
        db.cartons,
        db.inbounds,
        db.outbounds,
        db.movements,
        db.meta,
        db.counters,
      ],
      async () => {
        if (payload.items?.length) await db.items.bulkAdd(payload.items);
        if (payload.warehouses?.length) await db.warehouses.bulkAdd(payload.warehouses);
        if (payload.warehouseFloors?.length) await db.warehouseFloors.bulkAdd(payload.warehouseFloors);
        if (payload.locations?.length) await db.locations.bulkAdd(payload.locations);
        if (payload.suppliers?.length) await db.suppliers.bulkAdd(payload.suppliers);
        if (payload.customers?.length) await db.customers.bulkAdd(payload.customers);
        if (payload.cartons?.length) await db.cartons.bulkAdd(payload.cartons);
        if (payload.inbounds?.length) await db.inbounds.bulkAdd(payload.inbounds);
        if (payload.outbounds?.length) await db.outbounds.bulkAdd(payload.outbounds);
        if (payload.movements?.length) await db.movements.bulkAdd(payload.movements);
        if (payload.counters?.length) await db.counters.bulkAdd(payload.counters);
        if (payload.meta?.length) await db.meta.bulkAdd(payload.meta);
        else {
          await db.meta.put({
            id: META_ID,
            seeded: true,
            seedVersion: payload.version ?? SEED_VERSION,
            lastResetAt: nowIso(),
          });
        }
      },
    );
  }

  private async clearAllTables(): Promise<void> {
    await Promise.all([
      db.items.clear(),
      db.warehouses.clear(),
      db.warehouseFloors.clear(),
      db.locations.clear(),
      db.suppliers.clear(),
      db.customers.clear(),
      db.cartons.clear(),
      db.inbounds.clear(),
      db.outbounds.clear(),
      db.movements.clear(),
      db.qiHeaders.clear(),
      db.qiEvidence.clear(),
      db.inventoryTransactions.clear(),
      db.statusAdjustments.clear(),
      db.meta.clear(),
      db.counters.clear(),
    ]);
  }

  private floor(
    wh: Warehouse,
    floorCode: string,
    floorName: string,
    sortOrder: number,
    stamp: string,
    cols = 12,
    rows = 8,
  ): WarehouseFloor {
    return {
      id: createId('wfl'),
      warehouseId: wh.id,
      warehouseCode: wh.warehouseCode,
      floorCode,
      floorName,
      sortOrder,
      cols,
      rows,
      status: MasterStatus.Active,
      createdAt: stamp,
      updatedAt: stamp,
    };
  }

  private loc(
    code: string,
    name: string,
    wh: Warehouse,
    type: LocationType,
    stamp: string,
    capacity = 50,
    zone?: string,
    rack?: string,
    bin?: string,
    floor?: WarehouseFloor,
    mapX = 0,
    mapY = 0,
    mapW = 2,
    mapH = 2,
  ): LocationBin {
    return {
      id: createId('loc'),
      locationCode: code,
      locationName: name,
      warehouseId: wh.id,
      warehouseCode: wh.warehouseCode,
      locationType: type,
      floorId: floor?.id,
      floorCode: floor?.floorCode,
      zone,
      rack,
      bin,
      mapX,
      mapY,
      mapW,
      mapH,
      capacity,
      status: MasterStatus.Active,
      createdAt: stamp,
      updatedAt: stamp,
    };
  }

  private buildInbound(
    docNo: string,
    supplier: Supplier,
    warehouse: Warehouse,
    linesInput: Array<{ item: Item; qty: number; loc: LocationBin; barcodes: string[] }>,
    stamp: string,
  ): InboundHeader {
    const lines = linesInput.map((l, idx) => ({
      id: createId('inl'),
      itemId: l.item.id,
      itemCode: l.item.itemCode,
      itemName: l.item.itemName,
      quantity: l.qty,
      locationId: l.loc.id,
      locationCode: l.loc.locationCode,
      barcodes: l.barcodes,
      expiredDate: '2027-12-31',
      batchNo: `SEED-BCH-${idx + 1}`,
      qcStatus: CartonQcStatus.UU,
      uuDate: stamp.slice(0, 10),
    }));
    return {
      id: createId('inb'),
      docNo,
      supplierId: supplier.id,
      supplierCode: supplier.supplierCode,
      supplierName: supplier.supplierName,
      warehouseId: warehouse.id,
      warehouseCode: warehouse.warehouseCode,
      inboundDate: stamp,
      inspectionType: CartonQcStatus.UU,
      status: InboundStatus.Completed,
      notes: 'Sample inbound (UU)',
      totalCarton: lines.reduce((s, l) => s + l.quantity, 0),
      lines,
      createdBy: 'Demo User',
      createdAt: stamp,
      updatedAt: stamp,
      confirmedAt: stamp,
      source: 'manual',
    };
  }
}
