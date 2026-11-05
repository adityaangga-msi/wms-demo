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
import { AdjustmentKind, MovementStatus, QuantityAdjustDirection } from '../../core/enums';
import { MovementHeader } from '../../core/models';
import { MovementService } from '../../core/services/movement.service';
import { NotificationService } from '../../core/services/notification.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-movement-list',
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
  templateUrl: './movement-list.html',
  styleUrl: './movement-list.scss',
})
export class MovementList implements OnInit {
  private readonly service = inject(MovementService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly rows = signal<MovementHeader[]>([]);
  readonly filtered = signal<MovementHeader[]>([]);
  readonly statuses = Object.values(MovementStatus);
  readonly cols = [
    'docNo',
    'kind',
    'movementDate',
    'from',
    'to',
    'totalCarton',
    'status',
    'actions',
  ];

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
      this.notify.error(err instanceof Error ? err.message : 'Gagal memuat adjustment.');
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
          r.fromWarehouseCode.toLowerCase().includes(term) ||
          r.toWarehouseCode.toLowerCase().includes(term);
        return matchQ && (!status || r.status === status);
      }),
    );
  }

  kindLabel(row: MovementHeader): string {
    const kind = row.adjustKind ?? AdjustmentKind.Location;
    if (kind === AdjustmentKind.Location) return 'Tempat';
    return row.qtyDirection === QuantityAdjustDirection.Increase ? 'Qty +' : 'Qty −';
  }

  create(): void {
    void this.router.navigate(['/operations/adjustment/new']);
  }
}
