import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.scss',
})
export class StatusBadge {
  readonly status = input.required<string>();

  readonly tone = computed(() => {
    const s = (this.status() || '').toLowerCase();
    if (
      ['active', 'available', 'completed', 'uu', 'passed', 'verified', 'approved'].includes(s)
    ) {
      return 'success';
    }
    if (
      [
        'draft',
        'receiving',
        'picking',
        'inprogress',
        'in progress',
        'intransit',
        'in transit',
        'reserved',
        'qi pending',
        'qi',
        'pending',
        'partially completed',
      ].includes(s)
    ) {
      return 'info';
    }
    if (
      ['inactive', 'cancelled', 'shipped', 'picked', 'returned', 'scrapped', 'rejected'].includes(
        s,
      )
    ) {
      return 'muted';
    }
    if (['quarantine', 'return pending', 'hold', 'failed'].includes(s)) return 'warn';
    if (['blocked', 'scrap pending'].includes(s)) return 'danger';
    return 'neutral';
  });
}
