import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DemoDataService } from '../../core/services/demo-data.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../shared/components/page-header/page-header';

@Component({
  selector: 'app-demo-data',
  imports: [PageHeader, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './demo-data.html',
  styleUrl: './demo-data.scss',
})
export class DemoData {
  private readonly demo = inject(DemoDataService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly busy = signal(false);

  async loadSample(): Promise<void> {
    this.busy.set(true);
    try {
      await this.demo.loadSampleData(false);
      this.notify.success('Sample data dimuat.');
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal load sample.');
    } finally {
      this.busy.set(false);
    }
  }

  async reset(): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          data: {
            title: 'Reset Demo Data',
            message:
              'Semua data lokal akan dihapus dan diganti sample seed. Lanjutkan?',
            confirmText: 'Reset',
            danger: true,
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    this.busy.set(true);
    try {
      await this.demo.resetDemoData();
      this.notify.success('Demo data di-reset.');
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal reset.');
    } finally {
      this.busy.set(false);
    }
  }

  async exportJson(): Promise<void> {
    this.busy.set(true);
    try {
      const json = await this.demo.exportJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kartondock-wms-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.notify.success('Export JSON berhasil.');
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal export.');
    } finally {
      this.busy.set(false);
    }
  }

  pickImport(): void {
    this.fileInput()?.nativeElement.click();
  }

  async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.busy.set(true);
    try {
      const text = await file.text();
      await this.demo.importJson(text);
      this.notify.success('Import JSON berhasil.');
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal import.');
    } finally {
      this.busy.set(false);
      input.value = '';
    }
  }
}
