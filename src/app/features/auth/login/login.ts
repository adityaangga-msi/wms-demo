import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  AuthService,
  DEMO_USERS,
  DemoUser,
  DemoUserCategory,
} from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PreferencesService } from '../../../core/services/preferences.service';

type DemoFilter = 'all' | DemoUserCategory;

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  readonly prefs = inject(PreferencesService);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('ambientCanvas');
  private raf = 0;
  private particles: { x: number; y: number; r: number; a: number; s: number }[] = [];

  readonly year = new Date().getFullYear();
  readonly showPassword = signal(false);
  readonly showDemoPicker = signal(false);
  readonly submitting = signal(false);
  readonly demoFilter = signal<DemoFilter>('all');
  readonly demoQuery = signal('');
  readonly demoUsers = DEMO_USERS;

  readonly form = this.fb.nonNullable.group({
    email: ['admin@kartondock.demo', [Validators.required, Validators.email]],
    password: ['password123', Validators.required],
    remember: [true],
  });

  readonly filteredDemo = computed(() => {
    const q = this.demoQuery().trim().toLowerCase();
    const filter = this.demoFilter();
    return this.demoUsers.filter((u) => {
      if (filter !== 'all' && u.category !== filter) return false;
      if (!q) return true;
      return [u.name, u.email, u.role, u.division, u.blurb]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  });

  readonly filterCounts = computed(() => ({
    all: this.demoUsers.length,
    admin: this.demoUsers.filter((u) => u.category === 'admin').length,
    supervisor: this.demoUsers.filter((u) => u.category === 'supervisor').length,
    staff: this.demoUsers.filter((u) => u.category === 'staff').length,
  }));

  ngAfterViewInit(): void {
    this.startAmbient();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  setLang(lang: 'id' | 'en'): void {
    this.prefs.setLanguage(lang);
  }

  openDemoPicker(): void {
    this.showDemoPicker.set(true);
  }

  closeDemoPicker(): void {
    this.showDemoPicker.set(false);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.error('Lengkapi email dan kata sandi.');
      return;
    }
    this.submitting.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      this.auth.beginLogin(email, password);
      void this.router.navigateByUrl('/otp');
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal masuk.');
    } finally {
      this.submitting.set(false);
    }
  }

  pickDemo(user: DemoUser): void {
    this.auth.beginLoginAs(user);
    this.closeDemoPicker();
    void this.router.navigateByUrl('/otp');
  }

  private startAmbient(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      this.particles = Array.from({ length: 28 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 1.5 + Math.random() * 3.5,
        a: 0.12 + Math.random() * 0.35,
        s: 0.15 + Math.random() * 0.35,
      }));
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of this.particles) {
        p.y -= p.s;
        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `rgba(255,255,255,${p.a})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }
}
