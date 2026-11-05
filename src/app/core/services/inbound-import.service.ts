import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import { CartonQcStatus } from '../enums';
import { InboundDraftInput, InboundLineInput, InboundService } from './inbound.service';
import { ItemStorageService } from './item-storage.service';
import { LocationStorageService } from './location-storage.service';
import { SupplierStorageService } from './supplier-storage.service';
import { WarehouseStorageService } from './warehouse-storage.service';

export interface ExternalInboundPayload {
  externalSystem?: string;
  externalDocNo?: string;
  supplierCode: string;
  warehouseCode: string;
  inboundDate?: string;
  notes?: string;
  lines: Array<{
    itemCode: string;
    quantity: number;
    locationCode: string;
    expiredDate: string;
    batchNo?: string;
    qcStatus?: 'QI' | 'UU';
    uuDate?: string;
    externalRef?: string;
    barcodes?: string[];
  }>;
}

@Injectable({ providedIn: 'root' })
export class InboundImportService {
  private readonly inbound = inject(InboundService);
  private readonly items = inject(ItemStorageService);
  private readonly warehouses = inject(WarehouseStorageService);
  private readonly locations = inject(LocationStorageService);
  private readonly suppliers = inject(SupplierStorageService);

  async importExcelFile(file: File): Promise<{ draftId: string; docNo: string; lineCount: number }> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    if (!sheet) throw new Error('Sheet Excel kosong.');
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    if (!rows.length) throw new Error('Tidak ada baris data di Excel.');

    const payload = this.rowsToPayload(rows, file.name);
    return this.createFromExternal(payload, 'excel');
  }

  async importJsonText(raw: string): Promise<{ draftId: string; docNo: string; lineCount: number }> {
    let parsed: ExternalInboundPayload;
    try {
      parsed = JSON.parse(raw) as ExternalInboundPayload;
    } catch {
      throw new Error('JSON tidak valid.');
    }
    return this.createFromExternal(parsed, 'api');
  }

  async createFromExternal(
    payload: ExternalInboundPayload,
    source: 'excel' | 'api',
  ): Promise<{ draftId: string; docNo: string; lineCount: number }> {
    const [suppliers, warehouses, items, locations] = await Promise.all([
      this.suppliers.getActive(),
      this.warehouses.getActive(),
      this.items.getActive(),
      this.locations.getActive(),
    ]);

    const supplier = findByCode(suppliers, payload.supplierCode, (s) => s.supplierCode);
    const warehouse = findByCode(warehouses, payload.warehouseCode, (w) => w.warehouseCode);
    if (!supplier) throw new Error(`Supplier code tidak ditemukan: ${payload.supplierCode}`);
    if (!warehouse) throw new Error(`Warehouse code tidak ditemukan: ${payload.warehouseCode}`);
    if (!payload.lines?.length) throw new Error('Payload tidak memiliki lines.');

    const lines: InboundLineInput[] = payload.lines.map((l, idx) => {
      const item = findByCode(items, l.itemCode, (it) => it.itemCode);
      if (!item) throw new Error(`Baris ${idx + 1}: itemCode ${l.itemCode} tidak ditemukan.`);
      const loc = locations.find(
        (x) =>
          x.warehouseId === warehouse.id &&
          x.locationCode.toLowerCase() === String(l.locationCode).trim().toLowerCase(),
      );
      if (!loc) {
        throw new Error(
          `Baris ${idx + 1}: location ${l.locationCode} tidak ada di warehouse ${warehouse.warehouseCode}.`,
        );
      }
      const qc = normalizeQc(l.qcStatus);
      return {
        itemId: item.id,
        quantity: Number(l.quantity),
        locationId: loc.id,
        expiredDate: normalizeDate(l.expiredDate),
        batchNo: l.batchNo ? String(l.batchNo) : undefined,
        qcStatus: qc,
        uuDate: l.uuDate ? normalizeDate(l.uuDate) : undefined,
        externalRef: l.externalRef,
        barcodes: l.barcodes,
      };
    });

    const input: InboundDraftInput = {
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      inboundDate: payload.inboundDate
        ? new Date(normalizeDate(payload.inboundDate)).toISOString()
        : new Date().toISOString(),
      notes: payload.notes || `Import ${source}`,
      lines,
      source,
      externalSystem: payload.externalSystem || (source === 'excel' ? 'Excel Upload' : 'External API'),
      externalDocNo: payload.externalDocNo,
    };

    const draft = await this.inbound.createDraft(input);
    return { draftId: draft.id, docNo: draft.docNo, lineCount: draft.lines.length };
  }

  buildSampleExcel(): Blob {
    const rows = [
      {
        supplierCode: 'SUP001',
        warehouseCode: 'WH01',
        inboundDate: '2026-11-05',
        itemCode: 'ITEM001',
        quantity: 2,
        locationCode: 'R01-A01',
        expiredDate: '2027-06-30',
        batchNo: 'BATCH-DEMO-01',
        qcStatus: 'QI',
        uuDate: '',
        notes: 'Sample excel inbound',
      },
      {
        supplierCode: 'SUP001',
        warehouseCode: 'WH01',
        inboundDate: '2026-11-05',
        itemCode: 'ITEM002',
        quantity: 1,
        locationCode: 'R01-B02',
        expiredDate: '2027-01-15',
        batchNo: 'BATCH-DEMO-02',
        qcStatus: 'UU',
        uuDate: '2026-11-10',
        notes: 'Sample excel inbound',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inbound');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  sampleApiPayload(): string {
    return JSON.stringify(
      {
        externalSystem: 'ERP-Cimory',
        externalDocNo: 'PO-2026-7788',
        supplierCode: 'SUP001',
        warehouseCode: 'WH01',
        inboundDate: '2026-11-05',
        notes: 'Push dari sistem ERP (simulasi)',
        lines: [
          {
            itemCode: 'ITEM001',
            quantity: 3,
            locationCode: 'R01-A01',
            expiredDate: '2027-12-31',
            batchNo: 'ERP-BCH-100',
            qcStatus: 'QI',
          },
          {
            itemCode: 'ITEM003',
            quantity: 2,
            locationCode: 'R02-B01',
            expiredDate: '2027-03-01',
            batchNo: 'ERP-BCH-200',
            qcStatus: 'UU',
            uuDate: '2026-11-20',
            externalRef: 'ASN-LINE-2',
          },
        ],
      } satisfies ExternalInboundPayload,
      null,
      2,
    );
  }

  private rowsToPayload(
    rows: Record<string, unknown>[],
    fileName: string,
  ): ExternalInboundPayload {
    const first = rows[0]!;
    const supplierCode = String(pick(first, ['supplierCode', 'SupplierCode', 'supplier']) || '');
    const warehouseCode = String(pick(first, ['warehouseCode', 'WarehouseCode', 'warehouse']) || '');
    if (!supplierCode || !warehouseCode) {
      throw new Error('Kolom supplierCode dan warehouseCode wajib di Excel.');
    }

    return {
      externalSystem: 'Excel Upload',
      externalDocNo: fileName,
      supplierCode,
      warehouseCode,
      inboundDate: String(pick(first, ['inboundDate', 'InboundDate']) || '') || undefined,
      notes: String(pick(first, ['notes', 'Notes']) || 'Import Excel') || undefined,
      lines: rows.map((r, i) => {
        const itemCode = String(pick(r, ['itemCode', 'ItemCode', 'item']) || '');
        const locationCode = String(pick(r, ['locationCode', 'LocationCode', 'location']) || '');
        const expiredDate = String(pick(r, ['expiredDate', 'ExpiredDate', 'expDate', 'ExpDate']) || '');
        const quantity = Number(pick(r, ['quantity', 'Quantity', 'qty', 'Qty']) || 0);
        if (!itemCode || !locationCode || !expiredDate || quantity <= 0) {
          throw new Error(
            `Baris Excel ${i + 2}: itemCode, locationCode, expiredDate, quantity wajib.`,
          );
        }
        const qcRaw = String(pick(r, ['qcStatus', 'QcStatus', 'statusKarton', 'StatusKarton', 'statusPallete', 'StatusPallete']) || 'QI');
        const uuDate = String(pick(r, ['uuDate', 'UuDate', 'UUDate']) || '');
        return {
          itemCode,
          quantity,
          locationCode,
          expiredDate,
          batchNo: String(pick(r, ['batchNo', 'BatchNo', 'noBatch', 'NoBatch']) || '') || undefined,
          qcStatus: normalizeQc(qcRaw),
          uuDate: uuDate || undefined,
        };
      }),
    };
  }
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
  }
  // case-insensitive
  const map = new Map(Object.keys(row).map((k) => [k.toLowerCase(), row[k]]));
  for (const k of keys) {
    const v = map.get(k.toLowerCase());
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function findByCode<T>(list: T[], code: string, getter: (x: T) => string): T | undefined {
  const c = code.trim().toLowerCase();
  return list.find((x) => getter(x).toLowerCase() === c);
}

function normalizeQc(raw?: string): CartonQcStatus {
  const v = String(raw || 'QI').trim().toUpperCase();
  return v === 'UU' ? CartonQcStatus.UU : CartonQcStatus.QI;
}

function normalizeDate(value: string | Date | number): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serial date → JS date
    const utc = Date.UTC(1899, 11, 30) + value * 86400000;
    return new Date(utc).toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  throw new Error(`Format tanggal tidak dikenali: ${value}`);
}
