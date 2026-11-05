import {
  AdjustmentKind,
  CartonQcStatus,
  CartonStatus,
  ChecklistResult,
  InboundStatus,
  InspectionResult,
  InventoryStatus,
  LocationType,
  MasterStatus,
  MovementStatus,
  OutboundStatus,
  QiDisposition,
  QiDocStatus,
  QiDocVerificationStatus,
  QuantityAdjustDirection,
  TransactionType,
} from '../enums';

export interface Auditable {
  createdAt: string;
  updatedAt: string;
}

export interface Item extends Auditable {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
  description: string;
  /** Satuan stok utama di WMS (selalu Karton). */
  uom: 'Karton';
  /**
   * Isi 1 karton dalam satuan isi (pcs/kg/liter/dll).
   * Contoh: qtyPerCarton=12, contentUom=Pcs → 10 karton = 120 Pcs.
   */
  qtyPerCarton: number;
  /** Satuan isi per karton: Pcs, Kg, Liter, Botol, dll. */
  contentUom: string;
  barcodeConfig: string;
  status: MasterStatus;
}

export interface Warehouse extends Auditable {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  address: string;
  description: string;
  status: MasterStatus;
  /** Posisi di campus map (opsional). */
  mapX?: number;
  mapY?: number;
}

/** Lantai di dalam warehouse (seperti LV.01 di denah Pohi). */
export interface WarehouseFloor extends Auditable {
  id: string;
  warehouseId: string;
  warehouseCode: string;
  floorCode: string;
  floorName: string;
  sortOrder: number;
  cols: number;
  rows: number;
  status: MasterStatus;
}

export interface LocationBin extends Auditable {
  id: string;
  locationCode: string;
  locationName: string;
  warehouseId: string;
  warehouseCode: string;
  locationType: LocationType;
  floorId?: string;
  floorCode?: string;
  zone?: string;
  rack?: string;
  bin?: string;
  /** Posisi grid di denah lantai. */
  mapX?: number;
  mapY?: number;
  mapW?: number;
  mapH?: number;
  capacity?: number;
  status: MasterStatus;
}

export interface Supplier extends Auditable {
  id: string;
  supplierCode: string;
  supplierName: string;
  address: string;
  contact: string;
  status: MasterStatus;
}

export interface Customer extends Auditable {
  id: string;
  customerCode: string;
  customerName: string;
  address: string;
  contact: string;
  status: MasterStatus;
}

export interface CartonBarcode extends Auditable {
  id: string;
  barcode: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  inboundId?: string;
  inboundDocNo: string;
  inboundLineId?: string;
  warehouseId: string;
  warehouseCode: string;
  locationId: string;
  locationCode: string;
  receivingDate: string;
  /** Status operasional (Available / Reserved / Shipped / …). */
  status: CartonStatus;
  /** Status inventory (QI Pending / UU / Quarantine / …). */
  inventoryStatus: InventoryStatus;
  /** Inspection type asal inbound. */
  qcStatus?: CartonQcStatus;
  qiHeaderId?: string;
  qiDocNo?: string;
  lastInspectionResult?: InspectionResult;
  lastDisposition?: QiDisposition;
  batchNo?: string;
  expiredDate?: string;
  uuDate?: string;
  lastMovementDate?: string;
  outboundDocNo?: string;
  reservedDocNo?: string;
  externalRef?: string;
}

export interface InboundLine {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  locationId: string;
  locationCode: string;
  barcodes: string[];
  expiredDate?: string;
  batchNo?: string;
  qcStatus: CartonQcStatus;
  uuDate?: string;
  externalRef?: string;
}

export interface InboundHeader extends Auditable {
  id: string;
  docNo: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  warehouseId: string;
  warehouseCode: string;
  inboundDate: string;
  /** Inspection Type dokumen (QI / UU). */
  inspectionType: CartonQcStatus;
  status: InboundStatus;
  notes?: string;
  totalCarton: number;
  lines: InboundLine[];
  createdBy: string;
  confirmedAt?: string;
  qiHeaderId?: string;
  qiDocNo?: string;
  /** Sumber data: manual | excel | api */
  source?: 'manual' | 'excel' | 'api';
  externalSystem?: string;
  externalDocNo?: string;
}

export interface OutboundLine {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  barcodes: string[];
}

export interface OutboundHeader extends Auditable {
  id: string;
  docNo: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  warehouseId: string;
  warehouseCode: string;
  outboundDate: string;
  status: OutboundStatus;
  notes?: string;
  totalCarton: number;
  lines: OutboundLine[];
  scannedBarcodes: string[];
  createdBy: string;
  confirmedAt?: string;
}

export interface MovementLine {
  id: string;
  /** Kosong untuk baris qty increase sebelum konfirmasi. */
  barcode: string;
  /** Barcode hasil generate (qty increase). */
  barcodes?: string[];
  itemId: string;
  itemCode: string;
  itemName: string;
  fromLocationId: string;
  fromLocationCode: string;
  /** Qty karton untuk adjustment quantity (increase). */
  quantity?: number;
}

export interface MovementHeader extends Auditable {
  id: string;
  docNo: string;
  /** Default Location untuk data seed lama. */
  adjustKind: AdjustmentKind;
  qtyDirection?: QuantityAdjustDirection;
  fromWarehouseId: string;
  fromWarehouseCode: string;
  fromLocationId: string;
  fromLocationCode: string;
  toWarehouseId: string;
  toWarehouseCode: string;
  toLocationId: string;
  toLocationCode: string;
  movementDate: string;
  status: MovementStatus;
  notes?: string;
  totalCarton: number;
  lines: MovementLine[];
  createdBy: string;
  confirmedAt?: string;
}

export interface InventorySummaryRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  category?: string;
  warehouseId: string;
  warehouseCode: string;
  locationId: string;
  locationCode: string;
  totalCarton: number;
  availableCarton: number;
  reservedCarton: number;
  inboundCarton: number;
  outboundCarton: number;
  qtyPerCarton: number;
  contentUom: string;
  /** totalCarton × qtyPerCarton */
  totalContent: number;
  /** availableCarton × qtyPerCarton */
  availableContent: number;
}

export interface TransactionHistoryRow {
  id: string;
  docNo: string;
  transactionDate: string;
  transactionType: TransactionType;
  warehouseCode: string;
  totalCarton: number;
  status: string;
  createdBy: string;
  partyName?: string;
}

export interface DashboardKpi {
  totalItem: number;
  totalWarehouse: number;
  totalInventory: number;
  totalAvailable: number;
  inboundToday: number;
  outboundToday: number;
  movementToday: number;
  /** Extended QI / inventory KPIs */
  inboundCartonTotal: number;
  inboundQiCarton: number;
  inboundUuCarton: number;
  totalSupplier: number;
  qiAwaiting: number;
  qiInspected: number;
  qiPassed: number;
  qiRejected: number;
  qiQuarantine: number;
  qiBlocked: number;
  qiReturn: number;
  qiScrap: number;
  qiPassRate: number;
  qiRejectRate: number;
  outboundCartonTotal: number;
  outboundDocTotal: number;
  invUu: number;
  invQiPending: number;
  invQuarantine: number;
  invBlocked: number;
  invReturnPending: number;
  invScrapPending: number;
}

export interface QiSupportingDocument {
  id: string;
  qiHeaderId: string;
  docType: string;
  fileName: string;
  mimeType: string;
  /** Base64 data URL — kosong = belum diupload */
  dataUrl?: string;
  /** true jika file sudah diupload (bukan placeholder) */
  hasFile?: boolean;
  verificationStatus: QiDocVerificationStatus;
  verificationNotes?: string;
  uploadedAt: string;
}

export interface QiChecklistItem {
  id: string;
  qiDetailId: string;
  inspectionPoint: string;
  result: ChecklistResult;
  notes?: string;
  photoRequired?: boolean;
}

export interface QiEvidence {
  id: string;
  qiDetailId: string;
  qiHeaderId: string;
  barcode: string;
  fileName: string;
  mimeType: string;
  /** Binary photo stored in IndexedDB */
  blobData: ArrayBuffer;
  uploadedAt: string;
  description?: string;
}

export interface QiDetail {
  id: string;
  qiHeaderId: string;
  cartonId: string;
  barcode: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  locationId: string;
  locationCode: string;
  inspectionStatus: InspectionResult;
  disposition?: QiDisposition;
  failureReason?: string;
  notes?: string;
  inspectionDate?: string;
  inspectorId?: string;
  inspectorName?: string;
  checklist: QiChecklistItem[];
  evidenceIds: string[];
  historyRound: number;
  createdAt: string;
  updatedAt: string;
}

export interface QiHeader extends Auditable {
  id: string;
  docNo: string;
  inboundId: string;
  inboundDocNo: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  warehouseId: string;
  warehouseCode: string;
  itemCodes: string[];
  itemNames: string[];
  status: QiDocStatus;
  totalCarton: number;
  inspectedCarton: number;
  passedCarton: number;
  failedCarton: number;
  pendingCarton: number;
  inspectionDate?: string;
  inspectorId?: string;
  inspectorName?: string;
  details: QiDetail[];
  supportingDocs: QiSupportingDocument[];
  createdBy: string;
  completedAt?: string;
}

export interface InventoryTransaction {
  id: string;
  transactionNumber: string;
  transactionType: TransactionType;
  referenceDocumentId: string;
  referenceDocNo: string;
  cartonId: string;
  barcode: string;
  fromWarehouseId?: string;
  fromLocationId?: string;
  toWarehouseId?: string;
  toLocationId?: string;
  previousStatus?: InventoryStatus;
  newStatus?: InventoryStatus;
  previousCartonStatus?: CartonStatus;
  newCartonStatus?: CartonStatus;
  quantity: number;
  transactionDate: string;
  notes?: string;
  createdBy: string;
}

export interface StatusAdjustmentRequest extends Auditable {
  id: string;
  docNo: string;
  cartonId: string;
  barcode: string;
  previousStatus: InventoryStatus;
  newStatus: InventoryStatus;
  reason: string;
  referenceQiId?: string;
  referenceDocNo?: string;
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface RecentTransaction {
  docNo: string;
  type: TransactionType;
  date: string;
  totalCarton: number;
  status: string;
}

export interface LowStockAlert {
  itemCode: string;
  itemName: string;
  warehouseCode: string;
  availableCarton: number;
}

export interface AppMeta {
  id: string;
  seeded: boolean;
  seedVersion: number;
  lastResetAt?: string;
}

export interface DemoExportPayload {
  version: number;
  exportedAt: string;
  items: Item[];
  warehouses: Warehouse[];
  warehouseFloors?: WarehouseFloor[];
  locations: LocationBin[];
  suppliers: Supplier[];
  customers: Customer[];
  cartons: CartonBarcode[];
  inbounds: InboundHeader[];
  outbounds: OutboundHeader[];
  movements: MovementHeader[];
  qiHeaders?: QiHeader[];
  qiEvidence?: QiEvidence[];
  inventoryTransactions?: InventoryTransaction[];
  statusAdjustments?: StatusAdjustmentRequest[];
  meta: AppMeta[];
  counters: SequenceCounter[];
}

export interface SequenceCounter {
  id: string;
  key: string;
  value: number;
}
