import Dexie, { Table } from 'dexie';
import {
  AppMeta,
  CartonBarcode,
  Customer,
  InboundHeader,
  InventoryTransaction,
  Item,
  LocationBin,
  MovementHeader,
  OutboundHeader,
  QiEvidence,
  QiHeader,
  SequenceCounter,
  StatusAdjustmentRequest,
  Supplier,
  Warehouse,
  WarehouseFloor,
} from '../models';

export class WmsDatabase extends Dexie {
  items!: Table<Item, string>;
  warehouses!: Table<Warehouse, string>;
  warehouseFloors!: Table<WarehouseFloor, string>;
  locations!: Table<LocationBin, string>;
  suppliers!: Table<Supplier, string>;
  customers!: Table<Customer, string>;
  cartons!: Table<CartonBarcode, string>;
  inbounds!: Table<InboundHeader, string>;
  outbounds!: Table<OutboundHeader, string>;
  movements!: Table<MovementHeader, string>;
  qiHeaders!: Table<QiHeader, string>;
  qiEvidence!: Table<QiEvidence, string>;
  inventoryTransactions!: Table<InventoryTransaction, string>;
  statusAdjustments!: Table<StatusAdjustmentRequest, string>;
  meta!: Table<AppMeta, string>;
  counters!: Table<SequenceCounter, string>;

  constructor() {
    super('KartonDockWmsDemo');

    this.version(1).stores({
      items: 'id, itemCode, category, status, itemName',
      warehouses: 'id, warehouseCode, status',
      locations: 'id, locationCode, warehouseId, warehouseCode, status, locationType',
      suppliers: 'id, supplierCode, status',
      customers: 'id, customerCode, status',
      cartons:
        'id, barcode, itemId, itemCode, warehouseId, locationId, status, inboundDocNo, outboundDocNo, receivingDate',
      inbounds: 'id, docNo, status, warehouseId, supplierId, inboundDate, createdAt',
      outbounds: 'id, docNo, status, warehouseId, customerId, outboundDate, createdAt',
      movements: 'id, docNo, status, fromWarehouseId, toWarehouseId, movementDate, createdAt',
      meta: 'id',
      counters: 'id, key',
    });

    this.version(2).stores({
      items: 'id, itemCode, category, status, itemName',
      warehouses: 'id, warehouseCode, status',
      locations: 'id, locationCode, warehouseId, warehouseCode, status, locationType',
      suppliers: 'id, supplierCode, status',
      customers: 'id, customerCode, status',
      cartons:
        'id, barcode, itemId, itemCode, warehouseId, locationId, status, inboundDocNo, outboundDocNo, receivingDate, batchNo, qcStatus, expiredDate',
      inbounds: 'id, docNo, status, warehouseId, supplierId, inboundDate, createdAt, externalDocNo, source',
      outbounds: 'id, docNo, status, warehouseId, customerId, outboundDate, createdAt',
      movements: 'id, docNo, status, fromWarehouseId, toWarehouseId, movementDate, createdAt',
      meta: 'id',
      counters: 'id, key',
    });

    this.version(3).stores({
      items: 'id, itemCode, category, status, itemName',
      warehouses: 'id, warehouseCode, status',
      locations: 'id, locationCode, warehouseId, warehouseCode, status, locationType, zone, rack',
      suppliers: 'id, supplierCode, status',
      customers: 'id, customerCode, status',
      cartons:
        'id, barcode, itemId, itemCode, warehouseId, locationId, status, inventoryStatus, inboundId, inboundDocNo, outboundDocNo, receivingDate, batchNo, qcStatus, expiredDate, qiHeaderId, qiDocNo',
      inbounds:
        'id, docNo, status, warehouseId, supplierId, inboundDate, createdAt, externalDocNo, source, inspectionType, qiHeaderId',
      outbounds: 'id, docNo, status, warehouseId, customerId, outboundDate, createdAt',
      movements: 'id, docNo, status, fromWarehouseId, toWarehouseId, movementDate, createdAt',
      qiHeaders: 'id, docNo, inboundId, inboundDocNo, status, supplierId, warehouseId, inspectionDate, createdAt',
      qiEvidence: 'id, qiDetailId, qiHeaderId, barcode, uploadedAt',
      inventoryTransactions:
        'id, transactionNumber, transactionType, barcode, cartonId, referenceDocumentId, transactionDate',
      statusAdjustments: 'id, docNo, barcode, cartonId, status, createdAt',
      meta: 'id',
      counters: 'id, key',
    });

    this.version(4).stores({
      items: 'id, itemCode, category, status, itemName',
      warehouses: 'id, warehouseCode, status',
      warehouseFloors: 'id, warehouseId, warehouseCode, floorCode, sortOrder, status',
      locations:
        'id, locationCode, warehouseId, warehouseCode, status, locationType, zone, rack, floorId, floorCode',
      suppliers: 'id, supplierCode, status',
      customers: 'id, customerCode, status',
      cartons:
        'id, barcode, itemId, itemCode, warehouseId, locationId, status, inventoryStatus, inboundId, inboundDocNo, outboundDocNo, receivingDate, batchNo, qcStatus, expiredDate, qiHeaderId, qiDocNo',
      inbounds:
        'id, docNo, status, warehouseId, supplierId, inboundDate, createdAt, externalDocNo, source, inspectionType, qiHeaderId',
      outbounds: 'id, docNo, status, warehouseId, customerId, outboundDate, createdAt',
      movements: 'id, docNo, status, fromWarehouseId, toWarehouseId, movementDate, createdAt',
      qiHeaders: 'id, docNo, inboundId, inboundDocNo, status, supplierId, warehouseId, inspectionDate, createdAt',
      qiEvidence: 'id, qiDetailId, qiHeaderId, barcode, uploadedAt',
      inventoryTransactions:
        'id, transactionNumber, transactionType, barcode, cartonId, referenceDocumentId, transactionDate',
      statusAdjustments: 'id, docNo, barcode, cartonId, status, createdAt',
      meta: 'id',
      counters: 'id, key',
    });
  }
}

export const db = new WmsDatabase();
