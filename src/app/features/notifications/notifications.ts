import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
  AppNotification,
  NotificationCenterService,
} from '../../core/services/notification-center.service';
import { NotificationService } from '../../core/services/notification.service';
import { PageHeader } from '../../shared/components/page-header/page-header';

@Component({
  selector: 'app-notifications',
  imports: [
    PageHeader,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    RouterLink,
    DatePipe,
  ],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications {
  private readonly center = inject(NotificationCenterService);
  private readonly notify = inject(NotificationService);

  readonly filter = signal<'all' | 'unread'>('all');
  readonly unreadCount = this.center.unreadCount;
  readonly rows = computed(() => this.center.list(this.filter()));

  setFilter(value: 'all' | 'unread' | undefined): void {
    if (value === 'all' || value === 'unread') this.filter.set(value);
  }

  markRead(item: AppNotification): void {
    this.center.markRead(item.id);
    this.notify.success('Ditandai sudah dibaca.');
  }

  markAll(): void {
    this.center.markAllRead();
    this.notify.success('Semua notifikasi ditandai dibaca.');
  }

  simulate(channel: 'email' | 'phone', item: AppNotification): void {
    this.notify.info(
      `Simulasi kirim ke ${channel === 'email' ? 'email' : 'ponsel'} untuk ${item.refCode}.`,
    );
  }
}
