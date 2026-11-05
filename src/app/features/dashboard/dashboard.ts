import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { DashboardService } from '../../core/services/dashboard.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  DashboardKpi,
  LowStockAlert,
  RecentTransaction,
} from '../../core/models';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { PageLoader } from '../../shared/components/page-loader/page-loader';

@Component({
  selector: 'app-dashboard',
  imports: [
    PageHeader,
    StatusBadge,
    PageLoader,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    RouterLink,
    BaseChartDirective,
    DatePipe,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly dashboard = inject(DashboardService);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(true);
  readonly kpi = signal<DashboardKpi | null>(null);
  readonly recent = signal<RecentTransaction[]>([]);
  readonly alerts = signal<LowStockAlert[]>([]);

  readonly lineData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  readonly doughnutData = signal<ChartConfiguration<'doughnut'>['data']>({
    labels: [],
    datasets: [],
  });
  readonly barData = signal<ChartConfiguration<'bar'>['data']>({ labels: [], datasets: [] });

  readonly lineOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };
  readonly doughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
  };
  readonly barOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  readonly recentCols = ['docNo', 'type', 'date', 'totalCarton', 'status'];
  readonly alertCols = ['itemCode', 'itemName', 'warehouseCode', 'availableCarton'];

  async ngOnInit(): Promise<void> {
    try {
      const [kpi, flow, byWh, invStatus, recent, alerts, qiPass] = await Promise.all([
        this.dashboard.getKpis(),
        this.dashboard.getInboundVsOutbound(7),
        this.dashboard.getInventoryByWarehouse(),
        this.dashboard.getInventoryStatusDistribution(),
        this.dashboard.getRecentTransactions(8),
        this.dashboard.getLowStockAlerts(3),
        this.dashboard.getQiPassReject(),
      ]);
      this.kpi.set(kpi);
      this.recent.set(recent);
      this.alerts.set(alerts);
      this.lineData.set({
        labels: flow.labels,
        datasets: [
          {
            label: 'Inbound',
            data: flow.inbound,
            borderColor: '#3d8fd1',
            backgroundColor: 'rgba(61,143,209,0.14)',
            tension: 0.35,
            fill: true,
          },
          {
            label: 'Outbound',
            data: flow.outbound,
            borderColor: '#f0a202',
            backgroundColor: 'rgba(240,162,2,0.14)',
            tension: 0.35,
            fill: true,
          },
        ],
      });
      this.doughnutData.set({
        labels: invStatus.map((p) => p.label),
        datasets: [
          {
            data: invStatus.map((p) => p.value),
            backgroundColor: ['#2f9e6b', '#2f6fed', '#e08a1e', '#d64545', '#7c3aed', '#6b7280', '#3d8fd1'],
          },
        ],
      });
      this.barData.set({
        labels: qiPass.map((p) => p.label),
        datasets: [
          {
            data: qiPass.map((p) => p.value),
            backgroundColor: ['#2f9e6b', '#d64545'],
            borderRadius: 10,
          },
        ],
      });
      void byWh;
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal memuat dashboard.');
    } finally {
      this.loading.set(false);
    }
  }

  availablePct(k: DashboardKpi): number {
    if (!k.totalInventory) return 0;
    return Math.round((k.totalAvailable / k.totalInventory) * 100);
  }

  inventoryFill(k: DashboardKpi): number {
    const base = Math.max(k.totalInventory, 1);
    return Math.min(100, Math.round((k.totalInventory / (base + 10)) * 100) + 35);
  }

  flowShare(inbound: number, outbound: number): number {
    const total = inbound + outbound;
    if (!total) return 12;
    return Math.max(12, Math.round((inbound / total) * 100));
  }
}
