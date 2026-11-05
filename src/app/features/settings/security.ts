import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { PageHeader } from '../../shared/components/page-header/page-header';

@Component({
  selector: 'app-security',
  imports: [
    PageHeader,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './security.html',
  styleUrl: './security.scss',
})
export class SecurityPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    current: ['', Validators.required],
    next: ['', [Validators.required, Validators.minLength(6)]],
    confirm: ['', Validators.required],
  });

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { current, next, confirm } = this.form.getRawValue();
    if (next !== confirm) {
      this.notify.error('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    this.saving.set(true);
    try {
      this.auth.changePassword(current, next);
      this.notify.success('Kata sandi diperbarui.');
      this.form.reset();
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal mengubah kata sandi.');
    } finally {
      this.saving.set(false);
    }
  }
}
