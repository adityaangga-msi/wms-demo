export enum MasterStatus {
  Active = 'Active',
  Inactive = 'Inactive',
}

export enum CartonStatus {
  Available = 'Available',
  Reserved = 'Reserved',
  Picked = 'Picked',
  Shipped = 'Shipped',
  InTransit = 'InTransit',
  Inactive = 'Inactive',
}

/** Inspection type saat inbound (QI = perlu inspeksi, UU = langsung unrestricted). */
export enum CartonQcStatus {
  QI = 'QI',
  UU = 'UU',
}

/** Status inventory stok (terpisah dari CartonStatus operasional). */
export enum InventoryStatus {
  QiPending = 'QI Pending',
  UU = 'UU',
  Quarantine = 'Quarantine',
  Blocked = 'Blocked',
  ReturnPending = 'Return Pending',
  Returned = 'Returned',
  ScrapPending = 'Scrap Pending',
  Scrapped = 'Scrapped',
  Reserved = 'Reserved',
  InTransit = 'In Transit',
}

export enum InspectionResult {
  Pending = 'Pending',
  Passed = 'Passed',
  Failed = 'Failed',
  Hold = 'Hold',
}

export enum QiDisposition {
  ReleaseUU = 'Release to UU',
  Quarantine = 'Quarantine',
  Block = 'Block',
  Return = 'Return',
  Scrap = 'Scrap',
  ReInspection = 'Re-Inspection',
  Rework = 'Rework',
}

export enum QiDocStatus {
  Pending = 'Pending',
  InProgress = 'In Progress',
  PartiallyCompleted = 'Partially Completed',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

export enum QiDocVerificationStatus {
  Pending = 'Pending',
  Verified = 'Verified',
  Rejected = 'Rejected',
}

export enum ChecklistResult {
  Pass = 'Pass',
  Fail = 'Fail',
  NA = 'N/A',
}

export enum InboundStatus {
  Draft = 'Draft',
  Receiving = 'Receiving',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

export enum OutboundStatus {
  Draft = 'Draft',
  Picking = 'Picking',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

export enum MovementStatus {
  Draft = 'Draft',
  InProgress = 'InProgress',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

export enum AdjustmentKind {
  Location = 'Location',
  Quantity = 'Quantity',
  Status = 'Status',
}

export enum QuantityAdjustDirection {
  Increase = 'Increase',
  Decrease = 'Decrease',
}

export enum LocationType {
  Rack = 'Rack',
  Bin = 'Bin',
  Staging = 'Staging',
  Quarantine = 'Quarantine',
  OpenArea = 'OpenArea',
  QiArea = 'QI Area',
  BlockedArea = 'Blocked Area',
  ReturnArea = 'Return Area',
  ScrapArea = 'Scrap Area',
}

export enum TransactionType {
  Inbound = 'Inbound',
  Outbound = 'Outbound',
  Adjustment = 'Adjustment',
  QualityInspection = 'Quality Inspection',
  Return = 'Return',
  Scrap = 'Scrap',
  StatusChange = 'Status Change',
}

export enum DocPrefix {
  Inbound = 'INB',
  Outbound = 'OUT',
  Adjustment = 'ADJ',
  /** @deprecated alias */
  Movement = 'ADJ',
  QualityInspection = 'QI',
  InventoryTxn = 'ITX',
  StatusAdj = 'STA',
  Carton = 'CTN',
}

/** Status yang boleh outbound normal. */
export const OUTBOUND_ALLOWED_INVENTORY: InventoryStatus[] = [InventoryStatus.UU];

/** Status yang boleh adjustment lokasi normal. */
export const ADJUSTMENT_ALLOWED_INVENTORY: InventoryStatus[] = [InventoryStatus.UU];

/** Status yang masih dihitung sebagai stok aktif gudang. */
export const ACTIVE_STOCK_STATUSES: InventoryStatus[] = [
  InventoryStatus.QiPending,
  InventoryStatus.UU,
  InventoryStatus.Quarantine,
  InventoryStatus.Blocked,
  InventoryStatus.ReturnPending,
  InventoryStatus.ScrapPending,
  InventoryStatus.Reserved,
  InventoryStatus.InTransit,
];
