import { AfterViewInit, Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService, DEMO_OTP } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PreferencesService } from '../../../core/services/preferences.service';

@Component({
  selector: 'app-otp',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './otp.html',
  styleUrl: './otp.scss',
})
export class Otp implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  readonly prefs = inject(PreferencesService);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('ambientCanvas');
  private raf = 0;

  readonly year = new Date().getFullYear();
  readonly pending = this.auth.pendingUser;
  readonly submitting = signal(false);
  readonly demoCode = DEMO_OTP;

  readonly form = this.fb.nonNullable.group({
    code: [DEMO_OTP, [Validators.required, Validators.minLength(6)]],
  });

  ngAfterViewInit(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    const dots = Array.from({ length: 22 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 1.2 + Math.random() * 3,
      a: 0.1 + Math.random() * 0.3,
      s: 0.12 + Math.random() * 0.3,
    }));
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const d of dots) {
        d.y -= d.s;
        if (d.y < -8) {
          d.y = canvas.height + 8;
          d.x = Math.random() * canvas.width;
        }
        ctx.fillStyle = `rgba(255,255,255,${d.a})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
  }

  setLang(lang: 'id' | 'en'): void {
    this.prefs.setLanguage(lang);
  }

  verify(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    try {
      const user = this.auth.verifyOtp(this.form.controls.code.value, true);
      this.notify.success(`Selamat datang, ${user.name}`);
      void this.router.navigateByUrl('/dashboard');
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'OTP gagal.');
    } finally {
      this.submitting.set(false);
    }
  }

  back(): void {
    this.auth.cancelOtp();
    void this.router.navigateByUrl('/login');
  }
}
