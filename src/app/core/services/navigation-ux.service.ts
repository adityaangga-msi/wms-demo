import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavigationUxService {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly navigating = signal(false);
  readonly progress = signal(0);
  readonly pageKey = signal(0);

  private timer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;

    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
      if (e instanceof NavigationStart) this.begin();
      if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        this.finish(e instanceof NavigationEnd);
      }
    });
  }

  private begin(): void {
    this.navigating.set(true);
    this.progress.set(12);
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      const current = this.progress();
      if (current >= 88) return;
      this.progress.set(current + Math.max(1, (90 - current) * 0.08));
    }, 120);
  }

  private finish(bumpPage: boolean): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.progress.set(100);
    if (bumpPage) this.pageKey.update((v) => v + 1);
    // Keep veil briefly so outgoing fade + incoming rise overlap smoothly.
    window.setTimeout(() => {
      this.navigating.set(false);
      this.progress.set(0);
    }, 160);
  }
}
