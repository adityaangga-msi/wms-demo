import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { firstValueFrom } from 'rxjs';
import {
  ChecklistResult,
  InspectionResult,
  QiDisposition,
  QiDocStatus,
  QiDocVerificationStatus,
} from '../../core/enums';
import {
  QiDetail as QiDetailModel,
  QiEvidence,
  QiHeader,
  QiSupportingDocument,
} from '../../core/models';
import { DEFAULT_QI_CHECKPOINTS } from '../../core/qi/qi-checklist.defaults';
import { NotificationService } from '../../core/services/notification.service';
import { QiService } from '../../core/services/qi.service';
import {
  CameraCaptureDialog,
  CameraCaptureDialogData,
  CameraCaptureResult,
} from '../../shared/components/camera-capture-dialog/camera-capture-dialog';
import {
  DocumentViewerDialog,
  DocumentViewerDialogData,
} from '../../shared/components/document-viewer-dialog/document-viewer-dialog';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-qi-detail',
  imports: [
    PageHeader,
    StatusBadge,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatTableModule,
    MatDialogModule,
    RouterLink,
  ],
  templateUrl: './qi-detail.html',
  styleUrl: './qi-detail.scss',
})
export class QiDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(QiService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);

  readonly InspectionResult = InspectionResult;
  readonly QiDisposition = QiDisposition;
  readonly ChecklistResult = ChecklistResult;
  readonly QiDocVerificationStatus = QiDocVerificationStatus;
  readonly checkpoints = DEFAULT_QI_CHECKPOINTS;

  readonly doc = signal<QiHeader | null>(null);
  readonly editable = signal(true);
  readonly busy = signal(false);
  readonly selected = signal<Set<string>>(new Set());
  readonly activeDetail = signal<QiDetailModel | null>(null);
  readonly evidencePreviews = signal<{ id: string; url: string; fileName: string }[]>([]);
  readonly gallery = signal<{ id: string; url: string; barcode: string; fileName: string }[]>([]);

  readonly lineCols = [
    'select',
    'barcode',
    'item',
    'location',
    'inspectionStatus',
    'disposition',
    'actions',
  ];

  readonly inspectForm = this.fb.nonNullable.group({
    result: [InspectionResult.Passed as InspectionResult, Validators.required],
    disposition: [QiDisposition.ReleaseUU as QiDisposition, Validators.required],
    failureReason: [''],
    notes: [''],
    inspectorName: ['Demo Inspector'],
  });

  readonly checklistForm = this.fb.nonNullable.group({
    items: this.fb.array(
      DEFAULT_QI_CHECKPOINTS.map((point) =>
        this.fb.nonNullable.group({
          inspectionPoint: [point],
          result: [ChecklistResult.Pass as ChecklistResult],
          notes: [''],
        }),
      ),
    ),
  });

  get checklistItems() {
    return this.checklistForm.controls.items;
  }

  async ngOnInit(): Promise<void> {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) void this.load(id);
    });
    this.inspectForm.controls.result.valueChanges.subscribe((r) => {
      if (r === InspectionResult.Passed) {
        this.inspectForm.patchValue({ disposition: QiDisposition.ReleaseUU });
      } else if (r === InspectionResult.Failed || r === InspectionResult.Hold) {
        this.inspectForm.patchValue({ disposition: QiDisposition.Quarantine });
      }
    });
  }

  private async load(id: string): Promise<void> {
    let doc = await this.service.get(id);
    if (!doc) {
      this.notify.error('Dokumen QI tidak ditemukan.');
      void this.router.navigate(['/operations/qi']);
      return;
    }
    if (!doc.supportingDocs?.length) {
      doc = await this.service.ensureSupportingDocs(doc.id);
    }
    this.doc.set(doc);
    this.editable.set(
      doc.status !== QiDocStatus.Completed && doc.status !== QiDocStatus.Cancelled,
    );
    await this.refreshGallery(doc.id);
  }

  toggleSelect(detailId: string): void {
    const next = new Set(this.selected());
    if (next.has(detailId)) next.delete(detailId);
    else next.add(detailId);
    this.selected.set(next);
  }

  selectAllPending(): void {
    const ids = (this.doc()?.details ?? [])
      .filter((d) => d.inspectionStatus === InspectionResult.Pending)
      .map((d) => d.id);
    this.selected.set(new Set(ids));
  }

  openInspect(detail: QiDetailModel): void {
    this.activeDetail.set(detail);
    this.inspectForm.patchValue({
      result:
        detail.inspectionStatus === InspectionResult.Pending
          ? InspectionResult.Passed
          : detail.inspectionStatus,
      disposition: detail.disposition ?? QiDisposition.ReleaseUU,
      failureReason: detail.failureReason ?? '',
      notes: detail.notes ?? '',
    });
    if (detail.checklist?.length) {
      this.checklistForm.setControl(
        'items',
        this.fb.nonNullable.array(
          detail.checklist.map((c) =>
            this.fb.nonNullable.group({
              inspectionPoint: [c.inspectionPoint],
              result: [c.result],
              notes: [c.notes ?? ''],
            }),
          ),
        ),
      );
    }
    void this.loadEvidencePreviews(detail);
  }

  closeInspect(): void {
    this.activeDetail.set(null);
    this.revokePreviews();
    this.evidencePreviews.set([]);
  }

  private revokePreviews(): void {
    for (const p of this.evidencePreviews()) URL.revokeObjectURL(p.url);
    for (const g of this.gallery()) URL.revokeObjectURL(g.url);
  }

  private async loadEvidencePreviews(detail: QiDetailModel): Promise<void> {
    this.revokePreviews();
    const previews: { id: string; url: string; fileName: string }[] = [];
    for (const id of detail.evidenceIds) {
      const ev = await this.service.getEvidence(id);
      if (!ev) continue;
      const blob = new Blob([ev.blobData], { type: ev.mimeType });
      previews.push({ id: ev.id, url: URL.createObjectURL(blob), fileName: ev.fileName });
    }
    this.evidencePreviews.set(previews);
  }

  private async refreshGallery(qiId: string): Promise<void> {
    for (const g of this.gallery()) URL.revokeObjectURL(g.url);
    const all = await this.service.listEvidenceForHeader(qiId);
    this.gallery.set(
      all.map((ev) => ({
        id: ev.id,
        barcode: ev.barcode,
        fileName: ev.fileName,
        url: URL.createObjectURL(new Blob([ev.blobData], { type: ev.mimeType })),
      })),
    );
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await this.saveEvidenceFile(file);
  }

  async capturePhoto(): Promise<void> {
    if (!this.editable() || this.busy()) return;
    const result = await firstValueFrom(
      this.dialog
        .open<CameraCaptureDialog, CameraCaptureDialogData, CameraCaptureResult | null>(
          CameraCaptureDialog,
          {
            width: '560px',
            disableClose: true,
            data: { title: 'Foto Evidence QI', facingMode: 'environment' },
          },
        )
        .afterClosed(),
    );
    if (!result) return;
    const file = new File([result.blob], result.fileName, { type: result.mimeType });
    await this.saveEvidenceFile(file, 'Photo evidence (kamera)');
  }

  private async saveEvidenceFile(file: File, description = 'Photo evidence'): Promise<void> {
    const detail = this.activeDetail();
    const doc = this.doc();
    if (!detail || !doc || !this.editable()) return;
    if (!file.type.startsWith('image/')) {
      this.notify.error('Hanya file gambar yang didukung.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      this.notify.error('Maksimal 4MB per foto (demo IndexedDB).');
      return;
    }
    this.busy.set(true);
    try {
      const buf = await file.arrayBuffer();
      const { header } = await this.service.addEvidence(doc.id, detail.id, {
        fileName: file.name,
        mimeType: file.type || 'image/jpeg',
        blobData: buf,
        description,
      });
      this.doc.set(header);
      const updated = header.details.find((d) => d.id === detail.id)!;
      this.activeDetail.set(updated);
      await this.loadEvidencePreviews(updated);
      await this.refreshGallery(header.id);
      this.notify.success('Foto evidence tersimpan.');
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal simpan foto.');
    } finally {
      this.busy.set(false);
    }
  }

  async removeEvidence(evidenceId: string): Promise<void> {
    const detail = this.activeDetail();
    const doc = this.doc();
    if (!detail || !doc) return;
    try {
      const header = await this.service.removeEvidence(doc.id, detail.id, evidenceId);
      this.doc.set(header);
      const updated = header.details.find((d) => d.id === detail.id)!;
      this.activeDetail.set(updated);
      await this.loadEvidencePreviews(updated);
      await this.refreshGallery(header.id);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal hapus foto.');
    }
  }

  docHasFile(docRow: QiSupportingDocument): boolean {
    return !!(docRow.hasFile || docRow.dataUrl);
  }

  viewDoc(docRow: QiSupportingDocument): void {
    if (!this.docHasFile(docRow) || !docRow.dataUrl) {
      this.notify.error('Belum ada file untuk dilihat.');
      return;
    }
    const data: DocumentViewerDialogData = {
      title: docRow.docType,
      fileName: docRow.fileName,
      mimeType: docRow.mimeType,
      dataUrl: docRow.dataUrl,
    };
    this.dialog.open(DocumentViewerDialog, {
      data,
      width: 'min(820px, 96vw)',
      maxHeight: '92vh',
    });
  }

  async onSupportingDocSelected(event: Event, docId: string): Promise<void> {
    const doc = this.doc();
    if (!doc || !this.editable()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      this.notify.error('File terlalu besar (maks 8 MB).');
      return;
    }
    try {
      const dataUrl = await this.readFileAsDataUrl(file);
      const updated = await this.service.uploadSupportingDoc(doc.id, docId, {
        fileName: file.name,
        mimeType: file.type || this.guessMime(file.name),
        dataUrl,
      });
      this.doc.set(updated);
      this.notify.success(`File ${file.name} terupload.`);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal upload dokumen.');
    }
  }

  async addSupportingDoc(): Promise<void> {
    const doc = this.doc();
    if (!doc || !this.editable()) return;
    const docType = window.prompt('Jenis dokumen (contoh: COA, Packing List):')?.trim();
    if (!docType) return;
    try {
      const updated = await this.service.attachSupportingDoc(doc.id, {
        docType,
        fileName: '— belum diupload —',
        mimeType: '',
      });
      this.doc.set(updated);
      this.notify.success(`Slot "${docType}" ditambahkan.`);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menambah dokumen.');
    }
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Gagal membaca file.'));
      reader.readAsDataURL(file);
    });
  }

  private guessMime(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'application/octet-stream';
  }

  async verifyDoc(
    docId: string,
    status: QiDocVerificationStatus,
  ): Promise<void> {
    const doc = this.doc();
    if (!doc || !this.editable()) return;
    try {
      const notes =
        status === QiDocVerificationStatus.Rejected ? 'Dokumen ditolak pada verifikasi' : 'Verified';
      const updated = await this.service.updateDocVerification(doc.id, docId, status, notes);
      this.doc.set(updated);
      this.notify.success(`Dokumen ${status}.`);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal verifikasi.');
    }
  }

  async submitInspection(): Promise<void> {
    const detail = this.activeDetail();
    const doc = this.doc();
    if (!detail || !doc) return;
    if (this.inspectForm.invalid) {
      this.inspectForm.markAllAsTouched();
      return;
    }
    const v = this.inspectForm.getRawValue();
    if (
      (v.result === InspectionResult.Failed || v.result === InspectionResult.Hold) &&
      !v.failureReason.trim()
    ) {
      this.notify.error('Failure reason wajib untuk Failed/Hold.');
      return;
    }
    this.busy.set(true);
    try {
      const header = await this.service.submitInspection({
        qiHeaderId: doc.id,
        detailId: detail.id,
        result: v.result as InspectionResult.Passed | InspectionResult.Failed | InspectionResult.Hold,
        disposition: v.disposition,
        failureReason: v.failureReason || undefined,
        notes: v.notes || undefined,
        inspectorName: v.inspectorName,
        checklist: this.checklistItems.getRawValue(),
      });
      this.doc.set(header);
      this.notify.success(`Inspeksi ${detail.barcode} disimpan.`);
      this.closeInspect();
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal submit inspeksi.');
    } finally {
      this.busy.set(false);
    }
  }

  async bulkPass(): Promise<void> {
    const doc = this.doc();
    if (!doc || !this.editable()) return;
    const ids = [...this.selected()].filter((id) => {
      const d = doc.details.find((x) => x.id === id);
      return d?.inspectionStatus === InspectionResult.Pending;
    });
    if (!ids.length) {
      this.notify.error('Pilih karton Pending terlebih dahulu.');
      return;
    }
    this.busy.set(true);
    try {
      let header = doc;
      for (const id of ids) {
        header = await this.service.submitInspection({
          qiHeaderId: header.id,
          detailId: id,
          result: InspectionResult.Passed,
          disposition: QiDisposition.ReleaseUU,
          checklist: DEFAULT_QI_CHECKPOINTS.map((p) => ({
            inspectionPoint: p,
            result: ChecklistResult.Pass,
          })),
          inspectorName: 'Demo Inspector',
        });
      }
      this.doc.set(header);
      this.selected.set(new Set());
      this.notify.success(`${ids.length} karton Passed → UU.`);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Bulk pass gagal.');
    } finally {
      this.busy.set(false);
    }
  }

  async reInspect(detail: QiDetailModel): Promise<void> {
    const doc = this.doc();
    if (!doc || !this.editable()) return;
    this.busy.set(true);
    try {
      const header = await this.service.reInspect(doc.id, detail.id);
      this.doc.set(header);
      this.notify.success(`Re-Inspection ${detail.barcode} — status kembali QI Pending.`);
      const updated = header.details.find((d) => d.id === detail.id);
      if (updated) this.openInspect(updated);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Re-Inspection gagal.');
    } finally {
      this.busy.set(false);
    }
  }

  async completeQi(): Promise<void> {
    const doc = this.doc();
    if (!doc) return;
    this.busy.set(true);
    try {
      const updated = await this.service.complete(doc.id);
      this.doc.set(updated);
      this.editable.set(false);
      this.notify.success(`${updated.docNo} Completed.`);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Complete QI gagal.');
    } finally {
      this.busy.set(false);
    }
  }

  dispositionLabel(d?: QiDisposition): string {
    return d ?? '—';
  }

  invTone(status: InspectionResult): string {
    return status;
  }
}
