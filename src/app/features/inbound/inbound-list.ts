import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { InboundStatus } from '../../core/enums';
import { InboundHeader } from '../../core/models';
import { InboundService } from '../../core/services/inbound.service';
import { NotificationService } from '../../core/services/notification.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-inbound-list',
  imports: [
    PageHeader,
    StatusBadge,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
  ],
  templateUrl: './inbound-list.html',
  styleUrl: './inbound-list.scss',
})
export class InboundList implements OnInit {
  private readonly service = inject(InboundService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly rows = signal<InboundHeader[]>([]);
  readonly filtered = signal<InboundHeader[]>([]);
  readonly statuses = Object.values(InboundStatus);
  readonly cols = ['docNo', 'inboundDate', 'supplierName', 'warehouseCode', 'totalCarton', 'status', 'actions'];

  readonly filters = this.fb.nonNullable.group({
    q: [''],
    status: [''],
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
    this.filters.valueChanges.subscribe(() => this.applyFilter());
  }

  async reload(): Promise<void> {
    try {
      this.rows.set(await this.service.list());
      this.applyFilter();
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal memuat inbound.');
    }
  }

  applyFilter(): void {
    const { q, status } = this.filters.getRawValue();
    const term = q.trim().toLowerCase();
    this.filtered.set(
      this.rows().filter((r) => {
        const matchQ =
          !term ||
          r.docNo.toLowerCase().includes(term) ||
          r.supplierName.toLowerCase().includes(term) ||
          r.warehouseCode.toLowerCase().includes(term);
        const matchS = !status || r.status === status;
        return matchQ && matchS;
      }),
    );
  }

  create(): void {
    void this.router.navigate(['/operations/inbound/new']);
  }
}
