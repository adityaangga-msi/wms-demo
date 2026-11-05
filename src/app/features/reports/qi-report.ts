import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { InspectionResult } from '../../core/enums';
import { QiHeader } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { QiService } from '../../core/services/qi.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

interface QiReportRow {
  qiNumber: string;
  qiId: string;
  inboundNumber: string;
  barcode: string;
  itemCode: string;
  itemName: string;
  inspectionDate: string;
  inspector: string;
  inspectionResult: string;
  disposition: string;
  failureReason: string;
  photoCount: number;
  inventoryHint: string;
}

@Component({
  selector: 'app-qi-report',
  imports: [
    PageHeader,
    StatusBadge,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
  ],
  templateUrl: './qi-report.html',
  styleUrl: './reports.scss',
})
export class QiReport implements OnInit {
  private readonly qi = inject(QiService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly rows = signal<QiReportRow[]>([]);
  readonly filtered = signal<QiReportRow[]>([]);
  readonly results = Object.values(InspectionResult);
  readonly cols = [
    'qiNumber',
    'inboundNumber',
    'barcode',
    'itemCode',
    'itemName',
    'inspectionDate',
    'inspector',
    'inspectionResult',
    'disposition',
    'failureReason',
    'photoCount',
  ];

  readonly filters = this.fb.nonNullable.group({
    q: [''],
    result: [''],
  });

  async ngOnInit(): Promise<void> {
    try {
      const headers = await this.qi.list();
      const flat: QiReportRow[] = [];
      for (const h of headers) {
        for (const d of h.details) {
          flat.push({
            qiNumber: h.docNo,
            qiId: h.id,
            inboundNumber: h.inboundDocNo,
            barcode: d.barcode,
            itemCode: d.itemCode,
            itemName: d.itemName,
            inspectionDate: d.inspectionDate ?? h.inspectionDate ?? h.createdAt,
            inspector: d.inspectorName ?? h.inspectorName ?? '—',
            inspectionResult: d.inspectionStatus,
            disposition: d.disposition ?? '—',
            failureReason: d.failureReason ?? '—',
            photoCount: d.evidenceIds.length,
            inventoryHint: d.disposition ?? d.inspectionStatus,
          });
        }
      }
      this.rows.set(flat);
      this.applyFilter();
      this.filters.valueChanges.subscribe(() => this.applyFilter());
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal memuat QI report.');
    }
  }

  applyFilter(): void {
    const { q, result } = this.filters.getRawValue();
    const term = q.trim().toLowerCase();
    this.filtered.set(
      this.rows().filter((r) => {
        const matchQ =
          !term ||
          r.qiNumber.toLowerCase().includes(term) ||
          r.inboundNumber.toLowerCase().includes(term) ||
          r.barcode.toLowerCase().includes(term) ||
          r.itemCode.toLowerCase().includes(term);
        return matchQ && (!result || r.inspectionResult === result);
      }),
    );
  }

  exportCsv(): void {
    const header = this.cols.join(',');
    const body = this.filtered()
      .map((r) =>
        [
          r.qiNumber,
          r.inboundNumber,
          r.barcode,
          r.itemCode,
          r.itemName,
          r.inspectionDate,
          r.inspector,
          r.inspectionResult,
          r.disposition,
          `"${(r.failureReason || '').replace(/"/g, '""')}"`,
          r.photoCount,
        ].join(','),
      )
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qi-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
