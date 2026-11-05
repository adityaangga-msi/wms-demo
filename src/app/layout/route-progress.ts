import { Component, inject } from '@angular/core';
import { NavigationUxService } from '../core/services/navigation-ux.service';

@Component({
  selector: 'app-route-progress',
  template: `
    @if (ux.navigating() || ux.progress() > 0) {
      <div class="route-progress" aria-hidden="true">
        <div class="route-progress__bar" [style.width.%]="ux.progress()"></div>
      </div>
    }
  `,
  styles: `
    .route-progress {
      position: fixed;
      inset: 0 auto auto 0;
      width: 100%;
      height: 3px;
      z-index: 1000;
      pointer-events: none;
      background: transparent;
    }
    .route-progress__bar {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #f0a202, #3d8fd1 55%, #1f9d6c);
      box-shadow: 0 0 12px rgba(240, 162, 2, 0.45);
      transition: width 0.18s cubic-bezier(0.2, 0, 0.2, 1);
    }
  `,
})
export class RouteProgress {
  readonly ux = inject(NavigationUxService);
}
