import { Injectable, inject } from '@angular/core';
import {
  ADJUSTMENT_ALLOWED_INVENTORY,
  CartonStatus,
  InventoryStatus,
  OUTBOUND_ALLOWED_INVENTORY,
} from '../enums';
import { CartonBarcode } from '../models';
import { BarcodeStorageService } from './barcode-storage.service';
import { DocumentNumberService } from './document-number.service';

@Injectable({ providedIn: 'root' })
export class BarcodeService {
  private readonly storage = inject(BarcodeStorageService);
  private readonly docNumbers = inject(DocumentNumberService);

  generateBarcodes(count: number): Promise<string[]> {
    return this.docNumbers.nextCartonBarcodes(count);
  }

  normalize(code: string): string {
    return code.trim().toUpperCase();
  }

  async getCarton(barcode: string): Promise<CartonBarcode | undefined> {
    return this.storage.getByBarcode(this.normalize(barcode));
  }

  async assertUnique(barcodes: string[]): Promise<void> {
    for (const code of barcodes) {
      const existing = await this.storage.getByBarcode(this.normalize(code));
      if (existing) throw new Error(`Barcode ${code} sudah terdaftar.`);
    }
  }

  async validateForOutbound(
    barcode: string,
    warehouseId: string,
    alreadyScanned: string[],
  ): Promise<CartonBarcode> {
    const code = this.normalize(barcode);
    if (!code) throw new Error('Barcode kosong.');
    if (alreadyScanned.map((b) => this.normalize(b)).includes(code)) {
      throw new Error(`Barcode ${code} sudah di-scan pada dokumen ini.`);
    }
    const carton = await this.storage.getByBarcode(code);
    if (!carton) throw new Error(`Barcode ${code} tidak terdaftar.`);
    if (carton.status !== CartonStatus.Available) {
      throw new Error(`Barcode ${code} berstatus ${carton.status}, tidak bisa di-outbound.`);
    }
    const inv = carton.inventoryStatus ?? InventoryStatus.UU;
    if (!OUTBOUND_ALLOWED_INVENTORY.includes(inv)) {
      throw new Error(
        `Barcode ${code} inventory status ${inv} — hanya UU yang boleh Outbound.`,
      );
    }
    if (carton.warehouseId !== warehouseId) {
      throw new Error(`Barcode ${code} berada di warehouse ${carton.warehouseCode}.`);
    }
    if (carton.reservedDocNo) {
      throw new Error(`Barcode ${code} sedang dalam transaksi lain (${carton.reservedDocNo}).`);
    }
    return carton;
  }

  async validateForMovement(
    barcode: string,
    fromWarehouseId: string,
    fromLocationId: string,
    alreadyScanned: string[],
  ): Promise<CartonBarcode> {
    const code = this.normalize(barcode);
    if (!code) throw new Error('Barcode kosong.');
    if (alreadyScanned.map((b) => this.normalize(b)).includes(code)) {
      throw new Error(`Barcode ${code} sudah di-scan pada dokumen ini.`);
    }
    const carton = await this.storage.getByBarcode(code);
    if (!carton) throw new Error(`Barcode ${code} tidak terdaftar.`);
    if (carton.status !== CartonStatus.Available) {
      throw new Error(`Barcode ${code} berstatus ${carton.status}, tidak bisa dipindahkan.`);
    }
    const inv = carton.inventoryStatus ?? InventoryStatus.UU;
    if (!ADJUSTMENT_ALLOWED_INVENTORY.includes(inv)) {
      throw new Error(
        `Barcode ${code} inventory status ${inv} — adjustment normal hanya untuk UU.`,
      );
    }
    if (carton.warehouseId !== fromWarehouseId || carton.locationId !== fromLocationId) {
      throw new Error(
        `Barcode ${code} aktual di ${carton.warehouseCode} / ${carton.locationCode}.`,
      );
    }
    if (carton.reservedDocNo) {
      throw new Error(`Barcode ${code} sedang dalam transaksi lain (${carton.reservedDocNo}).`);
    }
    return carton;
  }
}
