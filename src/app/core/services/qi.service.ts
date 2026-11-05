import { Injectable, inject } from '@angular/core';
import { db } from '../db/wms-database';
import {
  CartonQcStatus,
  CartonStatus,
  ChecklistResult,
  DocPrefix,
  InspectionResult,
  InventoryStatus,
  QiDisposition,
  QiDocStatus,
  QiDocVerificationStatus,
  TransactionType,
} from '../enums';
import {
  CartonBarcode,
  InboundHeader,
  QiChecklistItem,
  QiDetail,
  QiEvidence,
  QiHeader,
  InventoryTransaction,
  QiSupportingDocument,
} from '../models';
import { DEFAULT_QI_CHECKPOINTS } from '../qi/qi-checklist.defaults';
import { nowIso } from '../utils/date.util';
import { createId } from '../utils/id.util';
import { DocumentNumberService } from './document-number.service';
import { InventoryTransactionService } from './inventory-transaction.service';

export interface InspectCartonInput {
  qiHeaderId: string;
  detailId: string;
  result: InspectionResult.Passed | InspectionResult.Failed | InspectionResult.Hold;
  disposition: QiDisposition;
  failureReason?: string;
  notes?: string;
  checklist: Array<{ inspectionPoint: string; result: ChecklistResult; notes?: string }>;
  inspectorName?: string;
}

@Injectable({ providedIn: 'root' })
export class QiService {
  private readonly docNumbers = inject(DocumentNumberService);
  private readonly inventoryTxn = inject(InventoryTransactionService);

  list(): Promise<QiHeader[]> {
    return db.qiHeaders.orderBy('createdAt').reverse().toArray();
  }

  get(id: string): Promise<QiHeader | undefined> {
    return db.qiHeaders.get(id);
  }

  getByInboundId(inboundId: string): Promise<QiHeader | undefined> {
    return db.qiHeaders.where('inboundId').equals(inboundId).first();
  }

  async createFromInbound(inbound: InboundHeader, cartons: CartonBarcode[]): Promise<QiHeader> {
    if (inbound.inspectionType !== CartonQcStatus.QI) {
      throw new Error('QI document hanya dibuat untuk Inbound Inspection Type = QI.');
    }
    const existing = await this.getByInboundId(inbound.id);
    if (existing) return existing;

    const stamp = nowIso();
    const docNo = await this.docNumbers.nextDocument(DocPrefix.QualityInspection);
    const headerId = createId('qi');

    const details: QiDetail[] = cartons.map((c) => ({
      id: createId('qid'),
      qiHeaderId: headerId,
      cartonId: c.id,
      barcode: c.barcode,
      itemId: c.itemId,
      itemCode: c.itemCode,
      itemName: c.itemName,
      locationId: c.locationId,
      locationCode: c.locationCode,
      inspectionStatus: InspectionResult.Pending,
      checklist: DEFAULT_QI_CHECKPOINTS.map((point) => ({
        id: createId('qic'),
        qiDetailId: '',
        inspectionPoint: point,
        result: ChecklistResult.NA,
      })),
      evidenceIds: [],
      historyRound: 1,
      createdAt: stamp,
      updatedAt: stamp,
    }));

    for (const d of details) {
      d.checklist = d.checklist.map((c) => ({ ...c, qiDetailId: d.id }));
    }

    const itemCodes = [...new Set(cartons.map((c) => c.itemCode))];
    const itemNames = [...new Set(cartons.map((c) => c.itemName))];

    const header: QiHeader = {
      id: headerId,
      docNo,
      inboundId: inbound.id,
      inboundDocNo: inbound.docNo,
      supplierId: inbound.supplierId,
      supplierCode: inbound.supplierCode,
      supplierName: inbound.supplierName,
      warehouseId: inbound.warehouseId,
      warehouseCode: inbound.warehouseCode,
      itemCodes,
      itemNames,
      status: QiDocStatus.Pending,
      totalCarton: cartons.length,
      inspectedCarton: 0,
      passedCarton: 0,
      failedCarton: 0,
      pendingCarton: cartons.length,
      details,
      supportingDocs: this.defaultSupportingDocs(headerId, stamp),
      createdBy: inbound.createdBy,
      createdAt: stamp,
      updatedAt: stamp,
    };

    const txns: InventoryTransaction[] = [];
    for (const c of cartons) {
      txns.push({
        id: createId('itx'),
        transactionNumber: await this.docNumbers.nextDocument(DocPrefix.InventoryTxn),
        transactionType: TransactionType.Inbound,
        referenceDocumentId: inbound.id,
        referenceDocNo: inbound.docNo,
        cartonId: c.id,
        barcode: c.barcode,
        toWarehouseId: c.warehouseId,
        toLocationId: c.locationId,
        previousStatus: undefined,
        newStatus: InventoryStatus.QiPending,
        previousCartonStatus: undefined,
        newCartonStatus: CartonStatus.Available,
        quantity: 1,
        transactionDate: stamp,
        notes: 'Inbound QI — masuk antrean Quality Inspection',
        createdBy: inbound.createdBy,
      });
    }

    await db.transaction(
      'rw',
      db.qiHeaders,
      db.inbounds,
      db.cartons,
      db.inventoryTransactions,
      async () => {
        await db.qiHeaders.put(header);
        await db.inbounds.put({
          ...inbound,
          qiHeaderId: header.id,
          qiDocNo: header.docNo,
          updatedAt: stamp,
        });
        for (const c of cartons) {
          await db.cartons.put({
            ...c,
            qiHeaderId: header.id,
            qiDocNo: header.docNo,
            inventoryStatus: InventoryStatus.QiPending,
            updatedAt: stamp,
          });
        }
        await db.inventoryTransactions.bulkAdd(txns);
      },
    );

    return header;
  }

  private defaultSupportingDocs(qiHeaderId: string, stamp: string): QiSupportingDocument[] {
    const types = ['Purchase Order', 'Delivery Order', 'Surat Jalan', 'Invoice'];
    return types.map((docType) => ({
      id: createId('qsd'),
      qiHeaderId,
      docType,
      fileName: '— belum diupload —',
      mimeType: '',
      hasFile: false,
      verificationStatus: QiDocVerificationStatus.Pending,
      uploadedAt: stamp,
    }));
  }

  /** Backfill slot dokumen untuk QI lama yang belum punya supportingDocs. */
  async ensureSupportingDocs(qiId: string): Promise<QiHeader> {
    const header = await this.get(qiId);
    if (!header) throw new Error('Dokumen QI tidak ditemukan.');
    if (header.supportingDocs?.length) return header;
    const stamp = nowIso();
    const updated: QiHeader = {
      ...header,
      supportingDocs: this.defaultSupportingDocs(qiId, stamp),
      updatedAt: stamp,
    };
    await db.qiHeaders.put(updated);
    return updated;
  }

  async updateDocVerification(
    qiId: string,
    docId: string,
    status: QiDocVerificationStatus,
    notes?: string,
  ): Promise<QiHeader> {
    const header = await this.requireEditable(qiId);
    const target = header.supportingDocs.find((d) => d.id === docId);
    if (!target) throw new Error('Dokumen tidak ditemukan.');
    if (status === QiDocVerificationStatus.Verified && !target.hasFile && !target.dataUrl) {
      throw new Error('Upload file dokumen dulu sebelum Verify.');
    }
    const supportingDocs = header.supportingDocs.map((d) =>
      d.id === docId
        ? { ...d, verificationStatus: status, verificationNotes: notes }
        : d,
    );
    const updated = { ...header, supportingDocs, updatedAt: nowIso() };
    await db.qiHeaders.put(updated);
    return updated;
  }

  async uploadSupportingDoc(
    qiId: string,
    docId: string,
    input: { fileName: string; mimeType: string; dataUrl: string },
  ): Promise<QiHeader> {
    const header = await this.requireEditable(qiId);
    const exists = header.supportingDocs.some((d) => d.id === docId);
    if (!exists) throw new Error('Slot dokumen tidak ditemukan.');
    const supportingDocs = header.supportingDocs.map((d) =>
      d.id === docId
        ? {
            ...d,
            fileName: input.fileName,
            mimeType: input.mimeType,
            dataUrl: input.dataUrl,
            hasFile: true,
            verificationStatus: QiDocVerificationStatus.Pending,
            verificationNotes: undefined,
            uploadedAt: nowIso(),
          }
        : d,
    );
    const updated = { ...header, supportingDocs, updatedAt: nowIso() };
    await db.qiHeaders.put(updated);
    return updated;
  }

  async attachSupportingDoc(
    qiId: string,
    input: { docType: string; fileName: string; mimeType: string; dataUrl?: string },
  ): Promise<QiHeader> {
    const header = await this.requireEditable(qiId);
    const doc: QiSupportingDocument = {
      id: createId('qsd'),
      qiHeaderId: qiId,
      docType: input.docType,
      fileName: input.fileName,
      mimeType: input.mimeType,
      dataUrl: input.dataUrl,
      hasFile: !!input.dataUrl,
      verificationStatus: QiDocVerificationStatus.Pending,
      uploadedAt: nowIso(),
    };
    const updated = {
      ...header,
      supportingDocs: [...header.supportingDocs, doc],
      updatedAt: nowIso(),
    };
    await db.qiHeaders.put(updated);
    return updated;
  }

  async removeSupportingDocFile(qiId: string, docId: string): Promise<QiHeader> {
    const header = await this.requireEditable(qiId);
    const supportingDocs = header.supportingDocs.map((d) =>
      d.id === docId
        ? {
            ...d,
            fileName: '— belum diupload —',
            mimeType: '',
            dataUrl: undefined,
            hasFile: false,
            verificationStatus: QiDocVerificationStatus.Pending,
            verificationNotes: undefined,
            uploadedAt: nowIso(),
          }
        : d,
    );
    const updated = { ...header, supportingDocs, updatedAt: nowIso() };
    await db.qiHeaders.put(updated);
    return updated;
  }

  async saveDraftDetail(
    qiId: string,
    detailId: string,
    patch: Partial<Pick<QiDetail, 'notes' | 'failureReason' | 'checklist'>>,
  ): Promise<QiHeader> {
    const header = await this.requireEditable(qiId);
    const details = header.details.map((d) =>
      d.id === detailId ? { ...d, ...patch, updatedAt: nowIso() } : d,
    );
    const updated = { ...header, details, updatedAt: nowIso(), status: this.computeStatus(details) };
    this.applyCounts(updated);
    await db.qiHeaders.put(updated);
    return updated;
  }

  async submitInspection(input: InspectCartonInput): Promise<QiHeader> {
    const header = await this.requireEditable(input.qiHeaderId);
    const detail = header.details.find((d) => d.id === input.detailId);
    if (!detail) throw new Error('QI detail tidak ditemukan.');

    if (
      input.result === InspectionResult.Passed &&
      input.disposition !== QiDisposition.ReleaseUU &&
      input.disposition !== QiDisposition.Rework
    ) {
      // Passed normally releases to UU
    }
    if (input.result !== InspectionResult.Passed && !input.disposition) {
      throw new Error('Disposition wajib untuk hasil Failed/Hold.');
    }
    if (
      input.result !== InspectionResult.Passed &&
      (!input.failureReason || !input.failureReason.trim())
    ) {
      throw new Error('Failure reason wajib jika tidak Passed.');
    }

    const stamp = nowIso();
    const inspectorName = input.inspectorName ?? 'Demo Inspector';
    const checklist: QiChecklistItem[] = input.checklist.map((c) => ({
      id: createId('qic'),
      qiDetailId: detail.id,
      inspectionPoint: c.inspectionPoint,
      result: c.result,
      notes: c.notes,
    }));

    const newDetail: QiDetail = {
      ...detail,
      inspectionStatus: input.result,
      disposition: input.disposition,
      failureReason: input.failureReason,
      notes: input.notes,
      checklist,
      inspectionDate: stamp,
      inspectorId: 'demo-inspector',
      inspectorName,
      updatedAt: stamp,
    };

    const inventoryStatus = this.dispositionToInventory(input.result, input.disposition);
    const carton = await db.cartons.get(detail.cartonId);
    if (!carton) throw new Error(`Karton ${detail.barcode} tidak ditemukan.`);

    const details = header.details.map((d) => (d.id === detail.id ? newDetail : d));
    const updatedHeader: QiHeader = {
      ...header,
      details,
      inspectorName,
      inspectorId: 'demo-inspector',
      inspectionDate: header.inspectionDate ?? stamp,
      updatedAt: stamp,
      status: this.computeStatus(details),
    };
    this.applyCounts(updatedHeader);

    // Nomor ITX dibuat di luar transaksi Dexie agar tidak nested-write ke counters
    // (penyebab submit inspeksi gagal → karton tetap Pending → Complete QI disabled).
    const transactionNumber = await this.docNumbers.nextDocument(DocPrefix.InventoryTxn);
    const nextCarton: CartonBarcode = {
      ...carton,
      inventoryStatus,
      lastInspectionResult: input.result,
      lastDisposition: input.disposition,
      uuDate:
        inventoryStatus === InventoryStatus.UU ? stamp.slice(0, 10) : carton.uuDate,
      status:
        inventoryStatus === InventoryStatus.Returned ||
        inventoryStatus === InventoryStatus.Scrapped
          ? CartonStatus.Inactive
          : carton.status,
      updatedAt: stamp,
    };

    await db.transaction(
      'rw',
      db.qiHeaders,
      db.cartons,
      db.inventoryTransactions,
      async () => {
        await db.qiHeaders.put(updatedHeader);
        await db.cartons.put(nextCarton);
        await this.inventoryTxn.add({
          transactionNumber,
          transactionType: TransactionType.QualityInspection,
          referenceDocumentId: header.id,
          referenceDocNo: header.docNo,
          cartonId: carton.id,
          barcode: carton.barcode,
          fromWarehouseId: carton.warehouseId,
          fromLocationId: carton.locationId,
          toWarehouseId: carton.warehouseId,
          toLocationId: carton.locationId,
          previousStatus: carton.inventoryStatus,
          newStatus: inventoryStatus,
          previousCartonStatus: carton.status,
          newCartonStatus: nextCarton.status,
          quantity: 1,
          transactionDate: stamp,
          notes: `${input.result} → ${input.disposition}${input.failureReason ? `: ${input.failureReason}` : ''}`,
          createdBy: inspectorName,
        });
      },
    );

    return (await this.get(header.id))!;
  }

  async addEvidence(
    qiId: string,
    detailId: string,
    file: { fileName: string; mimeType: string; blobData: ArrayBuffer; description?: string },
  ): Promise<{ header: QiHeader; evidence: QiEvidence }> {
    const header = await this.requireEditable(qiId);
    const detail = header.details.find((d) => d.id === detailId);
    if (!detail) throw new Error('QI detail tidak ditemukan.');

    const evidence: QiEvidence = {
      id: createId('qev'),
      qiDetailId: detailId,
      qiHeaderId: qiId,
      barcode: detail.barcode,
      fileName: file.fileName,
      mimeType: file.mimeType,
      blobData: file.blobData,
      uploadedAt: nowIso(),
      description: file.description,
    };

    const details = header.details.map((d) =>
      d.id === detailId
        ? { ...d, evidenceIds: [...d.evidenceIds, evidence.id], updatedAt: nowIso() }
        : d,
    );
    const updated = { ...header, details, updatedAt: nowIso() };

    await db.transaction('rw', db.qiHeaders, db.qiEvidence, async () => {
      await db.qiEvidence.put(evidence);
      await db.qiHeaders.put(updated);
    });

    return { header: updated, evidence };
  }

  async removeEvidence(qiId: string, detailId: string, evidenceId: string): Promise<QiHeader> {
    const header = await this.requireEditable(qiId);
    const details = header.details.map((d) =>
      d.id === detailId
        ? { ...d, evidenceIds: d.evidenceIds.filter((id) => id !== evidenceId), updatedAt: nowIso() }
        : d,
    );
    const updated = { ...header, details, updatedAt: nowIso() };
    await db.transaction('rw', db.qiHeaders, db.qiEvidence, async () => {
      await db.qiEvidence.delete(evidenceId);
      await db.qiHeaders.put(updated);
    });
    return updated;
  }

  getEvidence(id: string): Promise<QiEvidence | undefined> {
    return db.qiEvidence.get(id);
  }

  listEvidenceForHeader(qiId: string): Promise<QiEvidence[]> {
    return db.qiEvidence.where('qiHeaderId').equals(qiId).toArray();
  }

  async complete(qiId: string): Promise<QiHeader> {
    const header = await this.requireEditable(qiId);
    if (header.details.some((d) => d.inspectionStatus === InspectionResult.Pending)) {
      throw new Error('Tidak bisa Complete QI: masih ada karton Pending.');
    }
    const stamp = nowIso();
    const updated: QiHeader = {
      ...header,
      status: QiDocStatus.Completed,
      completedAt: stamp,
      updatedAt: stamp,
      inspectionDate: header.inspectionDate ?? stamp,
    };
    this.applyCounts(updated);
    await db.qiHeaders.put(updated);
    return updated;
  }

  async reInspect(qiId: string, detailId: string): Promise<QiHeader> {
    const header = await this.requireEditable(qiId);
    const detail = header.details.find((d) => d.id === detailId);
    if (!detail) throw new Error('QI detail tidak ditemukan.');
    if (detail.inspectionStatus === InspectionResult.Pending) {
      throw new Error('Karton masih Pending — belum perlu Re-Inspection.');
    }

    const stamp = nowIso();
    const carton = await db.cartons.get(detail.cartonId);
    if (!carton) throw new Error('Karton tidak ditemukan.');

    // Archive previous result in notes history; reset to Pending for new round
    const historyNote = [
      detail.notes,
      `[Round ${detail.historyRound}] ${detail.inspectionStatus}/${detail.disposition ?? '-'} @ ${detail.inspectionDate ?? ''}`,
    ]
      .filter(Boolean)
      .join('\n');

    const newDetail: QiDetail = {
      ...detail,
      inspectionStatus: InspectionResult.Pending,
      disposition: QiDisposition.ReInspection,
      failureReason: undefined,
      notes: historyNote,
      checklist: DEFAULT_QI_CHECKPOINTS.map((point) => ({
        id: createId('qic'),
        qiDetailId: detail.id,
        inspectionPoint: point,
        result: ChecklistResult.NA,
      })),
      historyRound: detail.historyRound + 1,
      inspectionDate: undefined,
      updatedAt: stamp,
    };

    const details = header.details.map((d) => (d.id === detailId ? newDetail : d));
    const updated: QiHeader = {
      ...header,
      details,
      status: this.computeStatus(details),
      updatedAt: stamp,
    };
    this.applyCounts(updated);

    const transactionNumber = await this.docNumbers.nextDocument(DocPrefix.InventoryTxn);
    await db.transaction('rw', db.qiHeaders, db.cartons, db.inventoryTransactions, async () => {
      await db.qiHeaders.put(updated);
      await db.cartons.put({
        ...carton,
        inventoryStatus: InventoryStatus.QiPending,
        lastDisposition: QiDisposition.ReInspection,
        updatedAt: stamp,
      });
      await this.inventoryTxn.add({
        transactionNumber,
        transactionType: TransactionType.QualityInspection,
        referenceDocumentId: header.id,
        referenceDocNo: header.docNo,
        cartonId: carton.id,
        barcode: carton.barcode,
        fromWarehouseId: carton.warehouseId,
        fromLocationId: carton.locationId,
        toWarehouseId: carton.warehouseId,
        toLocationId: carton.locationId,
        previousStatus: carton.inventoryStatus,
        newStatus: InventoryStatus.QiPending,
        previousCartonStatus: carton.status,
        newCartonStatus: carton.status,
        quantity: 1,
        transactionDate: stamp,
        notes: `Re-Inspection round ${newDetail.historyRound}`,
        createdBy: 'Demo Inspector',
      });
    });

    return (await this.get(qiId))!;
  }

  async releaseToUu(
    qiId: string,
    detailId: string,
    reason: string,
  ): Promise<QiHeader> {
    return this.submitInspection({
      qiHeaderId: qiId,
      detailId,
      result: InspectionResult.Passed,
      disposition: QiDisposition.ReleaseUU,
      notes: reason || 'Release to UU',
      checklist: DEFAULT_QI_CHECKPOINTS.map((p) => ({
        inspectionPoint: p,
        result: ChecklistResult.Pass,
      })),
    });
  }

  private dispositionToInventory(
    result: InspectionResult,
    disposition: QiDisposition,
  ): InventoryStatus {
    if (result === InspectionResult.Passed || disposition === QiDisposition.ReleaseUU) {
      return InventoryStatus.UU;
    }
    switch (disposition) {
      case QiDisposition.Quarantine:
        return InventoryStatus.Quarantine;
      case QiDisposition.Block:
        return InventoryStatus.Blocked;
      case QiDisposition.Return:
        return InventoryStatus.ReturnPending;
      case QiDisposition.Scrap:
        return InventoryStatus.ScrapPending;
      case QiDisposition.ReInspection:
      case QiDisposition.Rework:
        return InventoryStatus.QiPending;
      default:
        return InventoryStatus.Quarantine;
    }
  }

  private computeStatus(details: QiDetail[]): QiDocStatus {
    const pending = details.filter((d) => d.inspectionStatus === InspectionResult.Pending).length;
    const done = details.length - pending;
    if (details.length === 0 || done === 0) return QiDocStatus.Pending;
    // Semua baris sudah diinspeksi → siap Complete QI (bukan Completed sampai user klik Complete).
    if (pending === 0) return QiDocStatus.PartiallyCompleted;
    return QiDocStatus.InProgress;
  }

  private applyCounts(header: QiHeader): void {
    const pending = header.details.filter(
      (d) => d.inspectionStatus === InspectionResult.Pending,
    ).length;
    const passed = header.details.filter(
      (d) => d.inspectionStatus === InspectionResult.Passed,
    ).length;
    const failed = header.details.filter(
      (d) =>
        d.inspectionStatus === InspectionResult.Failed ||
        d.inspectionStatus === InspectionResult.Hold,
    ).length;
    header.pendingCarton = pending;
    header.passedCarton = passed;
    header.failedCarton = failed;
    header.inspectedCarton = passed + failed;
    header.totalCarton = header.details.length;
  }

  private async requireEditable(id: string): Promise<QiHeader> {
    const doc = await this.get(id);
    if (!doc) throw new Error('Dokumen QI tidak ditemukan.');
    if (doc.status === QiDocStatus.Completed || doc.status === QiDocStatus.Cancelled) {
      throw new Error('Dokumen QI Completed/Cancelled tidak dapat diedit.');
    }
    return doc;
  }
}
