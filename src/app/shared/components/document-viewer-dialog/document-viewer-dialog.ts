import { Component, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface DocumentViewerDialogData {
  title: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
}

@Component({
  selector: 'app-document-viewer-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="meta mono">{{ data.fileName }} · {{ data.mimeType || 'file' }}</p>
      @if (isImage) {
        <img class="preview" [src]="data.dataUrl" [alt]="data.fileName" />
      } @else if (isPdf) {
        <iframe class="frame" [src]="safeUrl" title="Preview PDF"></iframe>
      } @else {
        <p class="hint">Preview tidak tersedia untuk tipe ini. Gunakan Unduh / Buka.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <a mat-stroked-button [href]="data.dataUrl" [download]="data.fileName">
        <mat-icon>download</mat-icon>
        Unduh
      </a>
      <a mat-stroked-button [href]="data.dataUrl" target="_blank" rel="noopener">
        <mat-icon>open_in_new</mat-icon>
        Buka tab baru
      </a>
      <button mat-button type="button" mat-dialog-close>Tutup</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: min(720px, 92vw);
      max-height: 75vh;
    }
    .meta {
      margin: 0 0 0.75rem;
      font-size: 0.8rem;
      color: #64748b;
    }
    .preview {
      display: block;
      max-width: 100%;
      max-height: 65vh;
      margin: 0 auto;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .frame {
      width: 100%;
      height: min(65vh, 640px);
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
    }
    .hint {
      color: #64748b;
    }
    a[mat-stroked-button] {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      text-decoration: none;
    }
  `,
})
export class DocumentViewerDialog {
  readonly data = inject<DocumentViewerDialogData>(MAT_DIALOG_DATA);
  private readonly sanitizer = inject(DomSanitizer);
  readonly ref = inject(MatDialogRef<DocumentViewerDialog>);

  readonly isImage = (this.data.mimeType || '').startsWith('image/');
  readonly isPdf =
    (this.data.mimeType || '').includes('pdf') ||
    this.data.fileName.toLowerCase().endsWith('.pdf');
  readonly safeUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    this.data.dataUrl,
  );
}
