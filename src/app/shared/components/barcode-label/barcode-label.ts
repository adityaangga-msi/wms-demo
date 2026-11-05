import {
  AfterViewInit,
  Component,
  ElementRef,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export type LabelMode = 'barcode' | 'qr' | 'both';

@Component({
  selector: 'app-barcode-label',
  imports: [MatButtonModule, MatIconModule, MatButtonToggleModule],
  templateUrl: './barcode-label.html',
  styleUrl: './barcode-label.scss',
})
export class BarcodeLabel implements AfterViewInit {
  readonly barcode = input.required<string>();
  readonly itemCode = input('');
  readonly itemName = input('');
  readonly warehouseCode = input('');
  readonly locationCode = input('');
  readonly showPrint = input(true);
  readonly mode = input<LabelMode>('both');

  readonly activeMode = signal<LabelMode>('both');

  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('barcodeSvg');
  private readonly qrCanvas = viewChild<ElementRef<HTMLCanvasElement>>('qrCanvas');
  private ready = false;

  constructor() {
    effect(() => {
      const code = this.barcode();
      const mode = this.activeMode();
      if (!this.ready || !code) return;
      queueMicrotask(() => void this.render(code, mode));
    });
    effect(() => this.activeMode.set(this.mode()));
  }

  ngAfterViewInit(): void {
    this.ready = true;
    void this.render(this.barcode(), this.activeMode());
  }

  setMode(mode: LabelMode): void {
    this.activeMode.set(mode);
  }

  print(): void {
    window.print();
  }

  private async render(code: string, mode: LabelMode): Promise<void> {
    if (mode === 'barcode' || mode === 'both') this.renderBarcode(code);
    if (mode === 'qr' || mode === 'both') await this.renderQr(code);
  }

  private renderBarcode(code: string): void {
    const el = this.svg()?.nativeElement;
    if (!el || !code) return;
    try {
      JsBarcode(el, code, {
        format: 'CODE128',
        displayValue: true,
        fontSize: 14,
        height: 56,
        margin: 8,
        background: '#ffffff',
        lineColor: '#0b1728',
      });
    } catch {
      /* invalid */
    }
  }

  private async renderQr(code: string): Promise<void> {
    const canvas = this.qrCanvas()?.nativeElement;
    if (!canvas || !code) return;
    try {
      await QRCode.toCanvas(canvas, code, {
        width: 128,
        margin: 1,
        color: { dark: '#0b1728', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
    } catch {
      /* ignore */
    }
  }
}
