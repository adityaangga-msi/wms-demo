import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

@Component({
  selector: 'app-barcode-scanner',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './barcode-scanner.html',
  styleUrl: './barcode-scanner.scss',
})
export class BarcodeScanner implements OnDestroy {
  private readonly zone = inject(NgZone);

  readonly scanned = output<string>();
  readonly disabled = input(false);
  readonly label = input('Scan / ketik barcode atau QR');

  readonly manualValue = signal('');
  readonly cameraOn = signal(false);
  readonly cameraError = signal('');
  readonly lastCameraCode = signal('');

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('scanInput');
  private readonly cameraHost = viewChild<ElementRef<HTMLDivElement>>('cameraHost');
  private qr: Html5Qrcode | null = null;
  private lastEmitAt = 0;
  private lastEmitCode = '';

  submitManual(): void {
    if (this.disabled()) return;
    const code = this.manualValue().trim();
    if (!code) return;
    this.emit(code);
    this.manualValue.set('');
    queueMicrotask(() => this.inputEl()?.nativeElement.focus());
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.submitManual();
    }
  }

  async toggleCamera(): Promise<void> {
    if (this.cameraOn()) {
      await this.stopCamera();
      return;
    }
    await this.startCamera();
  }

  ngOnDestroy(): void {
    void this.stopCamera();
  }

  private emit(code: string): void {
    const normalized = code.trim().toUpperCase();
    if (!normalized || this.disabled()) return;
    const now = Date.now();
    if (normalized === this.lastEmitCode && now - this.lastEmitAt < 1200) return;
    this.lastEmitCode = normalized;
    this.lastEmitAt = now;
    this.scanned.emit(normalized);
  }

  private async startCamera(): Promise<void> {
    this.cameraError.set('');
    try {
      const host = this.cameraHost()?.nativeElement;
      if (!host) return;
      host.innerHTML = '';
      const id = 'kd-qr-' + Math.random().toString(36).slice(2);
      const box = document.createElement('div');
      box.id = id;
      host.appendChild(box);

      this.qr = new Html5Qrcode(id, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });

      await this.qr.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (viewW, viewH) => {
            const w = Math.floor(Math.min(viewW * 0.85, 280));
            const h = Math.floor(Math.min(viewH * 0.45, 160));
            return { width: w, height: h };
          },
          aspectRatio: 1.777,
        },
        (decoded: string) => {
          this.zone.run(() => {
            this.lastCameraCode.set(decoded);
            this.emit(decoded);
          });
        },
        () => undefined,
      );
      this.cameraOn.set(true);
    } catch (err) {
      this.cameraError.set(
        err instanceof Error
          ? err.message
          : 'Kamera tidak tersedia. Gunakan ketik manual / scanner USB.',
      );
      this.cameraOn.set(false);
      this.qr = null;
    }
  }

  private async stopCamera(): Promise<void> {
    try {
      if (this.qr?.isScanning) {
        await this.qr.stop();
      }
      await this.qr?.clear();
    } catch {
      /* ignore */
    }
    this.qr = null;
    this.cameraOn.set(false);
    const host = this.cameraHost()?.nativeElement;
    if (host) host.innerHTML = '';
  }
}
