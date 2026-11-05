import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { OutboundStatus } from '../../core/enums';
import { OutboundHeader } from '../../core/models';
import { OutboundService } from '../../core/services/outbound.service';
import { NotificationService } from '../../core/services/notification.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-outbound-list',
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
  templateUrl: './outbound-list.html',
  styleUrl: './outbound-list.scss',
})
export class OutboundList implements OnInit {
  private readonly service = inject(OutboundService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly rows = signal<OutboundHeader[]>([]);
  readonly filtered = signal<OutboundHeader[]>([]);
  readonly statuses = Object.values(OutboundStatus);
  readonly cols = ['docNo', 'outboundDate', 'customerName', 'warehouseCode', 'totalCarton', 'status', 'actions'];

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
      this.notify.error(err instanceof Error ? err.message : 'Gagal memuat outbound.');
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
          r.customerName.toLowerCase().includes(term) ||
          r.warehouseCode.toLowerCase().includes(term);
        return matchQ && (!status || r.status === status);
      }),
    );
  }

  create(): void {
    void this.router.navigate(['/operations/outbound/new']);
  }
}
