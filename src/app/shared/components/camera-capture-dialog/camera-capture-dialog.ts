import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface CameraCaptureDialogData {
  title?: string;
  facingMode?: 'environment' | 'user';
}

export interface CameraCaptureResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
}

@Component({
  selector: 'app-camera-capture-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.title || 'Ambil Foto Evidence' }}</h2>
    <mat-dialog-content>
      @if (error()) {
        <p class="err">{{ error() }}</p>
        <p class="hint">Pastikan izin kamera aktif, atau gunakan Upload file.</p>
      } @else {
        <div class="stage">
          @if (!snapshotUrl()) {
            <video #video autoplay playsinline muted></video>
          } @else {
            <img [src]="snapshotUrl()!" alt="Preview foto" />
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close()">Batal</button>
      @if (!error()) {
        @if (!snapshotUrl()) {
          <button mat-stroked-button type="button" (click)="flip()" [disabled]="!ready()">
            <mat-icon>cameraswitch</mat-icon>
            Ganti kamera
          </button>
          <button mat-flat-button class="btn-copper" type="button" (click)="snap()" [disabled]="!ready()">
            <mat-icon>photo_camera</mat-icon>
            Ambil foto
          </button>
        } @else {
          <button mat-stroked-button type="button" (click)="retake()">
            <mat-icon>refresh</mat-icon>
            Ulangi
          </button>
          <button mat-flat-button class="btn-copper" type="button" (click)="confirm()">
            <mat-icon>check</mat-icon>
            Pakai foto
          </button>
        }
      }
    </mat-dialog-actions>
    <canvas #canvas hidden></canvas>
  `,
  styles: `
    mat-dialog-content {
      min-width: min(520px, 86vw);
    }
    .stage {
      position: relative;
      background: #0b1728;
      border-radius: 12px;
      overflow: hidden;
      aspect-ratio: 4 / 3;
      display: grid;
      place-items: center;
    }
    video,
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .err {
      color: #b4231c;
      margin: 0 0 0.35rem;
      font-weight: 600;
    }
    .hint {
      margin: 0;
      color: #64748b;
      font-size: 0.85rem;
    }
    mat-dialog-actions button {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
  `,
})
export class CameraCaptureDialog implements AfterViewInit, OnDestroy {
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  readonly data = inject<CameraCaptureDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly ref = inject(MatDialogRef<CameraCaptureDialog, CameraCaptureResult | null>);

  readonly ready = signal(false);
  readonly error = signal<string | null>(null);
  readonly snapshotUrl = signal<string | null>(null);

  private stream: MediaStream | null = null;
  private facing: 'environment' | 'user' = this.data.facingMode ?? 'environment';
  private snapshotBlob: Blob | null = null;

  ngAfterViewInit(): void {
    void this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    const url = this.snapshotUrl();
    if (url) URL.revokeObjectURL(url);
  }

  close(): void {
    this.ref.close(null);
  }

  async flip(): Promise<void> {
    this.facing = this.facing === 'environment' ? 'user' : 'environment';
    await this.startCamera();
  }

  async snap(): Promise<void> {
    const video = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;
    if (!video || !canvas || !this.ready()) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9),
    );
    if (!blob) {
      this.error.set('Gagal mengambil foto dari kamera.');
      return;
    }
    this.snapshotBlob = blob;
    const prev = this.snapshotUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.snapshotUrl.set(URL.createObjectURL(blob));
    this.stopCamera();
  }

  async retake(): Promise<void> {
    const prev = this.snapshotUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.snapshotUrl.set(null);
    this.snapshotBlob = null;
    await this.startCamera();
  }

  confirm(): void {
    if (!this.snapshotBlob) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.ref.close({
      blob: this.snapshotBlob,
      fileName: `qi-evidence-${stamp}.jpg`,
      mimeType: 'image/jpeg',
    });
  }

  private async startCamera(): Promise<void> {
    this.ready.set(false);
    this.error.set(null);
    this.stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set('Browser tidak mendukung akses kamera.');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: this.facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      const video = this.videoRef?.nativeElement;
      if (!video) return;
      video.srcObject = this.stream;
      await video.play();
      this.ready.set(true);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Izinkan kamera di browser, lalu coba lagi.'
          : err instanceof Error
            ? err.message
            : 'Tidak bisa membuka kamera.';
      this.error.set(msg);
      this.ready.set(false);
    }
  }

  private stopCamera(): void {
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
      this.stream = null;
    }
    const video = this.videoRef?.nativeElement;
    if (video) video.srcObject = null;
    this.ready.set(false);
  }
}
