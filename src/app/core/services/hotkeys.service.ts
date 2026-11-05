import { Injectable, inject, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { ShortcutsDialog } from '../../shared/components/shortcuts-dialog/shortcuts-dialog';
import { APP_SHORTCUTS } from '../utils/shortcuts';

@Injectable({ providedIn: 'root' })
export class HotkeysService {
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  private pendingG = false;
  private started = false;

  readonly shortcuts = APP_SHORTCUTS;

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    fromEvent<KeyboardEvent>(window, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => this.onKey(e));
  }

  openHelp(): void {
    if (this.dialog.openDialogs.length) return;
    this.dialog.open(ShortcutsDialog, {
      width: '480px',
      maxWidth: '94vw',
      panelClass: 'kd-shortcuts-panel',
      autoFocus: false,
    });
  }

  private onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    const typing =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);
    if (typing) return;

    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      this.openHelp();
      return;
    }

    if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this.pendingG = true;
      window.setTimeout(() => (this.pendingG = false), 900);
      return;
    }

    if (!this.pendingG) return;
    this.pendingG = false;
    const map: Record<string, string> = {
      d: '/dashboard',
      n: '/notifications',
      i: '/operations/inbound',
      o: '/operations/outbound',
      m: '/operations/adjustment',
      s: '/inventory/summary',
      v: '/inventory/detail',
      b: '/inventory/barcode-tracking',
      r: '/reports/transactions',
      t: '/settings/demo-data',
    };
    const path = map[e.key.toLowerCase()];
    if (path) {
      e.preventDefault();
      void this.router.navigateByUrl(path);
    }
  }
}
