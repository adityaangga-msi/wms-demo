import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

const AVATARS = [
  { id: 'ops', tone: '#1a3a5c', label: 'Ops' },
  { id: 'steel', tone: '#3d8fd1', label: 'Steel' },
  { id: 'amber', tone: '#8a5a12', label: 'Amber' },
  { id: 'mint', tone: '#1f6b4a', label: 'Mint' },
];

@Component({
  selector: 'app-profile-edit-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  template: `
    <div class="dlg">
      <div class="dlg__head">
        <div class="dlg__icon"><mat-icon>info</mat-icon></div>
        <h2>Edit Profil</h2>
        <button mat-icon-button type="button" (click)="ref.close()" aria-label="Tutup">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dlg__body">
        <h3>Foto Profil</h3>
        <p class="hint">Pilih avatar bawaan (demo tidak menyimpan unggahan file).</p>

        <div class="photo-row">
          <div class="avatar" [style.background]="tone()">{{ previewInitials() }}</div>
          <button mat-stroked-button type="button" class="btn-secondary" disabled>
            <mat-icon>upload</mat-icon>
            Unggah Foto
          </button>
        </div>

        <p class="avatar-label">Pilih Avatar:</p>
        <div class="avatar-picks">
          @for (a of avatars; track a.id) {
            <button
              type="button"
              class="pick"
              [class.active]="tone() === a.tone"
              [style.background]="a.tone"
              [attr.aria-label]="a.label"
              (click)="tone.set(a.tone)"
            ></button>
          }
        </div>

        <form [formGroup]="form" class="form">
          <mat-form-field appearance="outline" class="full">
            <mat-label>Nama Lengkap *</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>No. Telepon / WhatsApp</mat-label>
            <input matInput formControlName="phone" placeholder="0812-xxxx-xxxx" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" readonly />
            <mat-hint>Akun resmi KartonDock demo</mat-hint>
          </mat-form-field>
        </form>
      </div>

      <div class="dlg__actions">
        <button mat-flat-button type="button" class="btn-primary" (click)="save()">
          Simpan Perubahan
        </button>
        <button mat-button type="button" (click)="ref.close()">Batal</button>
      </div>
    </div>
  `,
  styles: `
    .dlg {
      display: flex;
      flex-direction: column;
      max-height: min(84vh, 720px);
    }
    .dlg__head {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.75rem;
      align-items: center;
      padding: 1rem 1rem 0.65rem;
    }
    .dlg__icon {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: #1b62c9;
      color: #fff;
      display: grid;
      place-items: center;
    }
    h2 {
      margin: 0;
      font-size: 1.15rem;
      color: var(--kd-ink);
    }
    .dlg__body {
      padding: 0.35rem 1.15rem 0.5rem;
      overflow: auto;
    }
    h3 {
      margin: 0 0 0.25rem;
      font-size: 0.95rem;
    }
    .hint {
      margin: 0 0 0.85rem;
      color: var(--kd-muted);
      font-size: 0.82rem;
    }
    .photo-row {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      margin-bottom: 0.75rem;
    }
    .avatar {
      width: 72px;
      height: 72px;
      border-radius: 999px;
      color: #fff;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 1.15rem;
    }
    .avatar-label {
      margin: 0 0 0.45rem;
      font-size: 0.85rem;
      font-weight: 650;
    }
    .avatar-picks {
      display: flex;
      gap: 0.55rem;
      margin-bottom: 1rem;
    }
    .pick {
      width: 40px;
      height: 40px;
      border-radius: 999px;
      border: 2px solid transparent;
      cursor: pointer;
    }
    .pick.active {
      box-shadow: 0 0 0 3px #d6deea;
      border-color: #fff;
    }
    .full {
      width: 100%;
    }
    .dlg__actions {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding: 0.75rem 1.15rem 1.1rem;
    }
    .btn-primary {
      background: linear-gradient(135deg, #1a4f8c 0%, #0b1728 100%) !important;
      color: #fff !important;
      border-radius: 10px !important;
      font-weight: 700 !important;
      height: 42px;
    }
    .btn-secondary {
      border-radius: 10px !important;
    }
  `,
})
export class ProfileEditDialog {
  readonly ref = inject(MatDialogRef<ProfileEditDialog>);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly avatars = AVATARS;
  readonly tone = signal(this.auth.user()?.avatarTone || AVATARS[0]!.tone);

  readonly form = this.fb.nonNullable.group({
    name: [this.auth.user()?.name || '', Validators.required],
    phone: [this.auth.user()?.phone || ''],
    email: [{ value: this.auth.user()?.email || '', disabled: true }],
  });

  previewInitials(): string {
    const name = this.form.controls.name.value || this.auth.user()?.name || 'DU';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('');
  }

  save(): void {
    if (this.form.controls.name.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      this.auth.updateProfile({
        name: this.form.controls.name.value,
        phone: this.form.controls.phone.value,
        avatarTone: this.tone(),
        initials: this.previewInitials(),
      });
      this.notify.success('Profil diperbarui.');
      this.ref.close(true);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menyimpan.');
    }
  }
}
