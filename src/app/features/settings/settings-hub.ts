import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { DemoDataService } from '../../core/services/demo-data.service';
import { NotificationService } from '../../core/services/notification.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog';
import { ProfileEditDialog } from './profile-edit-dialog';

@Component({
  selector: 'app-settings-hub',
  imports: [PageHeader, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './settings-hub.html',
  styleUrl: './settings-hub.scss',
})
export class SettingsHub {
  private readonly auth = inject(AuthService);
  private readonly demo = inject(DemoDataService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly user = this.auth.user;

  openEditProfile(): void {
    this.dialog.open(ProfileEditDialog, {
      width: '560px',
      maxWidth: '95vw',
      autoFocus: false,
      panelClass: 'kd-profile-dialog',
    });
  }

  async logout(): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          width: '420px',
          data: {
            title: 'Keluar dari KartonDock?',
            message:
              'Sesi Anda akan diakhiri dan Anda perlu masuk kembali dengan email serta kode OTP.',
            confirmText: 'Ya, keluar sekarang',
            cancelText: 'Batal',
            danger: true,
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    this.auth.logout();
    this.notify.info('Anda telah keluar.');
    void this.router.navigateByUrl('/login');
  }

  async resetDemo(): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          data: {
            title: 'Reset Data Demo',
            message: 'Kembalikan seluruh data demo ke kondisi awal (simulasi; hanya mode lokal).',
            confirmText: 'Reset data demo',
            danger: true,
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    await this.demo.resetDemoData();
    this.notify.success('Demo data di-reset.');
  }
}
