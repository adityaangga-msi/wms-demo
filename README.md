# KartonDock WMS Demo

Demo **Inventory / Warehouse Management System** berbasis **karton** (bukan pallete).  
Aplikasi Angular standalone, tanpa backend — data tersimpan di **IndexedDB** (Dexie.js) di browser.

## Fitur

- Login demo (gaya ProAct, tema gudang) + akun demo
- Notifikasi operasional (badge unread, mark read, simulasi email/ponsel)
- Pintasan keyboard (`?` / `Ctrl+K`, navigasi `g` + huruf)
- Master Data: Item, Warehouse, Location, Supplier, Customer
- Inbound: draft → generate barcode per karton (`CTN######`) → konfirmasi → stok bertambah
- Outbound: scan barcode per karton → validasi → konfirmasi → stok berkurang
- Movement: pindah lokasi tanpa mengubah total stok
- Inventory Summary / Detail / Barcode Tracking
- Dashboard KPI + chart dari data transaksi nyata
- Reports + Demo Data (load / reset / export / import JSON)

### Akun demo

| Email | Password | Peran |
|-------|----------|--------|
| admin@kartondock.demo | password123 | Warehouse Admin |
| operator@kartondock.demo | password123 | Warehouse Operator |
| supervisor@kartondock.demo | password123 | Shift Supervisor |

## Menjalankan

```bash
cd "WMS Demo"
npm install
ng serve
```

Buka [http://localhost:4200](http://localhost:4200).

Build produksi:

```bash
ng build
```

## Stack

- Angular 22 (standalone + signals)
- TypeScript, SCSS, Angular Material
- Dexie.js (IndexedDB)
- Chart.js / ng2-charts
- JsBarcode + html5-qrcode (USB keyboard wedge + kamera opsional)

## Catatan demo

- Mode **DEMO**: semua data lokal di browser; refresh tidak menghapus data.
- Sample data otomatis di-seed saat pertama kali dibuka.
- Satuan terkecil = **Karton**. Tidak ada pallete / konversi pallete.
- Transaksi Completed tidak bisa diedit ulang; Cancelled tidak mengubah stok.
- Double posting dicegah saat konfirmasi inbound/outbound/movement.

## Struktur utama

```
src/app/
  core/          # enums, models, Dexie DB, storage & business services
  shared/        # page-header, status-badge, barcode scanner/label, confirm dialog
  layout/        # shell sidebar + top bar
  features/      # dashboard, master, inbound/outbound/movement, inventory, reports, settings
```

## Adaptasi dari Stock Card Application

Alur bisnis diadaptasi dari source Blazor/C# Cimory (inbound putaway, outbound scan, movement posisi), dengan perubahan fundamental:

| Existing | Demo ini |
|----------|----------|
| Satuan pallete (`PalleteCode`) | Satuan karton (`CTN######`) |
| Qty pieces + FP/PP | Qty karton saja |
| RealStock per pallete slot | 1 barcode = 1 karton available |

## UI

Brand **KartonDock** — sidebar teal-ink, aksen mint, CTA copper, font Plus Jakarta Sans + IBM Plex Mono. Layout enterprise (sidebar + top bar + cards), bukan template generik ungu/cream.
