import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm">
      <div class="confirm__head">
        <div class="confirm__icon" [class.danger]="data.danger">
          <mat-icon>{{ data.danger ? 'priority_high' : 'info' }}</mat-icon>
        </div>
        <h2>{{ data.title }}</h2>
        <button mat-icon-button type="button" (click)="ref.close(false)" aria-label="Tutup">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <p class="msg">{{ data.message }}</p>
      <div class="confirm__actions">
        <button
          mat-flat-button
          type="button"
          [class.danger]="data.danger"
          [class.primary]="!data.danger"
          (click)="ref.close(true)"
        >
          {{ data.confirmText || 'Konfirmasi' }}
        </button>
        <button mat-button type="button" (click)="ref.close(false)">
          {{ data.cancelText || 'Batal' }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .confirm {
      padding: 0.35rem 0.25rem 0.15rem;
    }
    .confirm__head {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.65rem;
      align-items: center;
      margin-bottom: 0.55rem;
    }
    .confirm__icon {
      width: 42px;
      height: 42px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: #e8f2fb;
      color: #1a4f8c;
    }
    .confirm__icon.danger {
      background: #fdeaea;
      color: #b4231c;
    }
    h2 {
      margin: 0;
      font-size: 1.05rem;
      color: var(--kd-ink, #101b2b);
    }
    .msg {
      margin: 0 0 1rem;
      color: #5a6b82;
      line-height: 1.5;
      max-width: 28rem;
      font-size: 0.9rem;
    }
    .confirm__actions {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    button.danger {
      background: #b4231c !important;
      color: #fff !important;
      border-radius: 10px !important;
      font-weight: 700 !important;
    }
    button.primary {
      background: linear-gradient(135deg, #1a4f8c, #0b1728) !important;
      color: #fff !important;
      border-radius: 10px !important;
      font-weight: 700 !important;
    }
  `,
})
export class ConfirmDialog {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<ConfirmDialog, boolean>);
}
