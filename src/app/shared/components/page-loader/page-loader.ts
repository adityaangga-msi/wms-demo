import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-loader',
  template: `
    <div class="page-loader" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <p>{{ label() }}</p>
    </div>
  `,
  styles: `
    .page-loader {
      display: grid;
      place-items: center;
      gap: 0.85rem;
      padding: 2.5rem 1rem;
      color: var(--kd-muted);
      font-size: 0.9rem;
      font-weight: 600;
    }
    .spinner {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 3px solid #dbe5ef;
      border-top-color: #f0a202;
      border-right-color: #3d8fd1;
      animation: spin 0.75s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class PageLoader {
  readonly label = input('Memuat…');
}
