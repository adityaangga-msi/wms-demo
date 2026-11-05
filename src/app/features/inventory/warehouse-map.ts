import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { CartonStatus, LocationType, MasterStatus } from '../../core/enums';
import { CartonBarcode, LocationBin, Warehouse, WarehouseFloor } from '../../core/models';
import { BarcodeStorageService } from '../../core/services/barcode-storage.service';
import { LocationStorageService } from '../../core/services/location-storage.service';
import { NotificationService } from '../../core/services/notification.service';
import { WarehouseFloorService } from '../../core/services/warehouse-floor.service';
import { WarehouseStorageService } from '../../core/services/warehouse-storage.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import {
  PohiBuilding,
  PohiFloor,
  PohiMapData,
  PohiRoom,
  PohiWmsMapEngine,
} from './pohi-wms-map.engine';

@Component({
  selector: 'app-warehouse-map',
  imports: [PageHeader, StatusBadge, MatButtonModule, RouterLink],
  templateUrl: './warehouse-map.html',
  styleUrl: './warehouse-map.scss',
  encapsulation: ViewEncapsulation.None,
})
export class WarehouseMap implements AfterViewInit, OnDestroy {
  @ViewChild('scene', { static: true }) sceneRef!: ElementRef<HTMLElement>;
  @ViewChild('stage', { static: true }) stageRef!: ElementRef<HTMLElement>;
  @ViewChild('panel', { static: true }) panelRef!: ElementRef<HTMLElement>;

  private readonly whSvc = inject(WarehouseStorageService);
  private readonly floorSvc = inject(WarehouseFloorService);
  private readonly locSvc = inject(LocationStorageService);
  private readonly barcodes = inject(BarcodeStorageService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);

  private engine: PohiWmsMapEngine | null = null;

  readonly hint = signal(
    '> Tarik gedung untuk pindah. Putar kiri/kanan di panel. Klik tanpa geser untuk masuk.',
  );
  readonly selectedCarton = signal<CartonBarcode | null>(null);
  readonly selectedLoc = signal<LocationBin | null>(null);
  readonly locCartons = signal<CartonBarcode[]>([]);
  readonly crumb = signal('MAP // SEMUA WAREHOUSE');

  async ngAfterViewInit(): Promise<void> {
    try {
      const data = await this.loadPohiData();
      this.engine = new PohiWmsMapEngine(
        this.sceneRef.nativeElement,
        this.stageRef.nativeElement,
        this.panelRef.nativeElement,
        data,
        {
          onHint: (t) => this.hint.set(t),
          onSelectRoom: (buildingId, floorId, locationId) =>
            void this.onSelectRoom(buildingId, floorId, locationId),
          onCreateBuilding: (draft) => this.createBuilding(draft),
          onCreateFloor: (buildingId, draft) => this.createFloor(buildingId, draft),
          onCreateRoom: (buildingId, floorId, room) =>
            this.createRoom(buildingId, floorId, room),
          onUpdateBuilding: (id, patch) => this.updateBuilding(id, patch),
          onUpdateFloor: (id, patch) => this.updateFloor(id, patch),
          onUpdateRoom: (_b, _f, locationId, room) => this.updateRoom(locationId, room),
          onDeleteBuilding: (id) => this.deleteBuilding(id),
          onDeleteFloor: (buildingId, floorId) => this.deleteFloor(buildingId, floorId),
          onDeleteRoom: (_b, _f, locationId) => this.deleteRoom(locationId),
        },
      );
      requestAnimationFrame(() => {
        this.engine?.layout();
        const q = this.route.snapshot.queryParamMap;
        this.engine?.focusByIds(q.get('wh'), q.get('floor'), q.get('loc'));
      });
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal memuat denah 3D.');
    }
  }

  ngOnDestroy(): void {
    this.engine?.destroy();
    this.engine = null;
  }

  private async loadPohiData(): Promise<PohiMapData> {
    const [whs, floors, locs] = await Promise.all([
      this.whSvc.getActive(),
      this.floorSvc.getAll(),
      this.locSvc.getAll(),
    ]);

    for (const wh of whs) {
      if (!floors.some((f) => f.warehouseId === wh.id)) {
        const fl = await this.floorSvc.ensureDefaultFloor(wh.id, wh.warehouseCode);
        floors.push(fl);
        for (const loc of locs.filter((l) => l.warehouseId === wh.id && !l.floorId)) {
          await this.locSvc.update(loc.id, { floorId: fl.id, floorCode: fl.floorCode });
          loc.floorId = fl.id;
          loc.floorCode = fl.floorCode;
        }
      }
    }

    const buildings: PohiBuilding[] = whs.map((wh, i) => {
      const whFloors = floors
        .filter((f) => f.warehouseId === wh.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return {
        id: wh.id,
        n: wh.warehouseCode,
        t: wh.warehouseName,
        x: wh.mapX ?? (i % 3) * 14,
        y: wh.mapY ?? Math.floor(i / 3) * 12,
        rot: 0,
        cols: Math.max(10, ...whFloors.map((f) => f.cols || 10)),
        rows: Math.max(8, ...whFloors.map((f) => f.rows || 8)),
        floors: whFloors.map((fl) => this.floorToPohi(fl, locs)),
      };
    });

    return { name: 'WMS Campus', buildings };
  }

  private floorToPohi(fl: WarehouseFloor, locs: LocationBin[]): PohiFloor {
    const rooms: PohiRoom[] = locs
      .filter((l) => l.floorId === fl.id)
      .map((l, idx) => {
        const x = l.mapX ?? (idx % 4) * 2;
        const y = l.mapY ?? Math.floor(idx / 4) * 2;
        const w = l.mapW ?? 2;
        const h = l.mapH ?? 2;
        const room: PohiRoom = [
          l.locationName || l.locationCode,
          x,
          y,
          w,
          h,
          l.locationCode,
          '',
          0,
          null,
          null,
          null,
          l.id,
          l.capacity ?? 50,
        ];
        return room;
      });
    return {
      id: fl.id,
      n: fl.floorCode,
      t: fl.floorName,
      r: rooms,
    };
  }

  private async onSelectRoom(
    buildingId: string,
    floorId: string,
    locationId: string | null,
  ): Promise<void> {
    if (!buildingId) {
      this.crumb.set('MAP // SEMUA WAREHOUSE');
      this.selectedLoc.set(null);
      this.locCartons.set([]);
      this.selectedCarton.set(null);
      return;
    }
    const wh = await this.whSvc.getById(buildingId);
    if (!floorId) {
      this.crumb.set(wh ? `WAREHOUSE // ${wh.warehouseCode}` : 'WAREHOUSE');
      this.selectedLoc.set(null);
      this.locCartons.set([]);
      return;
    }
    const fl = await this.floorSvc.getById(floorId);
    this.crumb.set(
      wh && fl ? `${wh.warehouseCode} // ${fl.floorCode}` : this.crumb(),
    );
    if (!locationId) {
      this.selectedLoc.set(null);
      this.locCartons.set([]);
      this.selectedCarton.set(null);
      return;
    }
    const loc = await this.locSvc.getById(locationId);
    this.selectedLoc.set(loc ?? null);
    if (!loc) return;
    this.locCartons.set(await this.barcodes.getByLocation(loc.id));
    this.selectedCarton.set(null);
  }

  private async createBuilding(draft: {
    code: string;
    name: string;
    x: number;
    y: number;
  }): Promise<{ building: PohiBuilding }> {
    const all = await this.whSvc.getAll();
    let code = draft.code;
    let i = all.length + 1;
    while (all.some((w) => w.warehouseCode.toUpperCase() === code.toUpperCase())) {
      i += 1;
      code = `WH${String(i).padStart(2, '0')}`;
    }
    const wh = await this.whSvc.create({
      warehouseCode: code,
      warehouseName: draft.name || `Warehouse ${i}`,
      address: '-',
      description: 'Dibuat dari denah 3D',
      status: MasterStatus.Active,
      mapX: draft.x,
      mapY: draft.y,
    });
    const fl = await this.floorSvc.ensureDefaultFloor(wh.id, wh.warehouseCode);
    this.notify.success(`Warehouse ${wh.warehouseCode} dibuat (klik untuk masuk).`);
    return {
      building: {
        id: wh.id,
        n: wh.warehouseCode,
        t: wh.warehouseName,
        x: draft.x,
        y: draft.y,
        rot: 0,
        cols: fl.cols,
        rows: fl.rows,
        floors: [{ id: fl.id, n: fl.floorCode, t: fl.floorName, r: [] }],
      },
    };
  }

  private async createFloor(
    buildingId: string,
    draft: { code: string; name: string },
  ): Promise<PohiFloor> {
    const wh = await this.whSvc.getById(buildingId);
    if (!wh) throw new Error('Warehouse tidak ditemukan.');
    const fl = await this.floorSvc.create({
      warehouseId: wh.id,
      warehouseCode: wh.warehouseCode,
      floorCode: draft.code,
      floorName: draft.name,
      cols: 12,
      rows: 8,
    });
    this.notify.success(`Lantai ${fl.floorCode} ditambahkan.`);
    return { id: fl.id, n: fl.floorCode, t: fl.floorName, r: [] };
  }

  private async createRoom(
    buildingId: string,
    floorId: string,
    room: PohiRoom,
  ): Promise<{ locationId: string; room: PohiRoom }> {
    const wh = await this.whSvc.getById(buildingId);
    const fl = await this.floorSvc.getById(floorId);
    if (!wh || !fl) throw new Error('Warehouse/lantai tidak valid.');
    const seq = (await this.locSvc.getByWarehouse(wh.id)).length + 1;
    const code = `${wh.warehouseCode}-${fl.floorCode.replace('.', '')}-B${String(seq).padStart(2, '0')}`;
    const capacity = room[12] ?? 50;
    const loc = await this.locSvc.create({
      locationCode: code,
      locationName: room[0] || code,
      warehouseId: wh.id,
      warehouseCode: wh.warehouseCode,
      locationType: LocationType.Bin,
      floorId: fl.id,
      floorCode: fl.floorCode,
      zone: fl.floorCode,
      mapX: room[1],
      mapY: room[2],
      mapW: room[3],
      mapH: room[4],
      capacity,
      status: MasterStatus.Active,
    });
    room[0] = loc.locationName;
    room[5] = loc.locationCode;
    room[11] = loc.id;
    room[12] = loc.capacity ?? capacity;
    this.notify.success(`Bin ${loc.locationCode} dibuat dari denah.`);
    await this.onSelectRoom(buildingId, floorId, loc.id);
    return { locationId: loc.id, room };
  }

  private async updateBuilding(
    id: string,
    patch: Partial<PohiBuilding>,
  ): Promise<void> {
    const data: Partial<Warehouse> = {};
    if (patch.n != null) data.warehouseCode = patch.n;
    if (patch.t != null) data.warehouseName = patch.t;
    if (patch.x != null) data.mapX = patch.x;
    if (patch.y != null) data.mapY = patch.y;
    if (Object.keys(data).length) await this.whSvc.update(id, data);
  }

  private async updateFloor(id: string, patch: Partial<PohiFloor>): Promise<void> {
    const data: Partial<WarehouseFloor> = {};
    if (patch.n != null) data.floorCode = patch.n;
    if (patch.t != null) data.floorName = patch.t;
    if (Object.keys(data).length) await this.floorSvc.update(id, data);
  }

  private async updateRoom(locationId: string, room: PohiRoom): Promise<void> {
    await this.locSvc.update(locationId, {
      locationName: room[0],
      mapX: room[1],
      mapY: room[2],
      mapW: room[3],
      mapH: room[4],
      capacity: room[12] ?? undefined,
    });
    const loc = await this.locSvc.getById(locationId);
    if (loc) this.selectedLoc.set(loc);
  }

  private async confirmDanger(title: string, message: string): Promise<boolean> {
    const ok = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          data: { title, message, confirmText: 'Hapus', danger: true },
        })
        .afterClosed(),
    );
    return !!ok;
  }

  private async deleteBuilding(id: string): Promise<boolean> {
    const wh = await this.whSvc.getById(id);
    if (!wh) return false;
    const stock = (await this.barcodes.getByWarehouse(id)).filter(
      (c) => c.status !== CartonStatus.Shipped && c.status !== CartonStatus.Inactive,
    );
    if (stock.length) {
      this.notify.error(
        `Warehouse ${wh.warehouseCode} masih punya ${stock.length} karton aktif. Kosongkan stok dulu.`,
      );
      return false;
    }
    if (
      !(await this.confirmDanger(
        'Hapus Warehouse',
        `Hapus ${wh.warehouseCode} beserta semua lantai & bin kosong?`,
      ))
    ) {
      return false;
    }
    const floors = await this.floorSvc.getByWarehouse(id);
    const locs = await this.locSvc.getByWarehouse(id);
    for (const loc of locs) await this.locSvc.remove(loc.id);
    for (const fl of floors) await this.floorSvc.remove(fl.id);
    await this.whSvc.remove(id);
    this.notify.success(`Warehouse ${wh.warehouseCode} dihapus.`);
    this.selectedLoc.set(null);
    this.locCartons.set([]);
    return true;
  }

  private async deleteFloor(buildingId: string, floorId: string): Promise<boolean> {
    const fl = await this.floorSvc.getById(floorId);
    if (!fl) return false;
    const locs = (await this.locSvc.getByWarehouse(buildingId)).filter((l) => l.floorId === floorId);
    for (const loc of locs) {
      const stock = (await this.barcodes.getByLocation(loc.id)).filter(
        (c) => c.status !== CartonStatus.Shipped && c.status !== CartonStatus.Inactive,
      );
      if (stock.length) {
        this.notify.error(
          `Lantai ${fl.floorCode} masih punya stok di bin ${loc.locationCode}.`,
        );
        return false;
      }
    }
    if (
      !(await this.confirmDanger(
        'Hapus Lantai',
        `Hapus ${fl.floorCode} beserta ${locs.length} bin kosong?`,
      ))
    ) {
      return false;
    }
    for (const loc of locs) await this.locSvc.remove(loc.id);
    await this.floorSvc.remove(floorId);
    this.notify.success(`Lantai ${fl.floorCode} dihapus.`);
    this.selectedLoc.set(null);
    this.locCartons.set([]);
    return true;
  }

  private async deleteRoom(locationId: string): Promise<boolean> {
    const loc = await this.locSvc.getById(locationId);
    if (!loc) return false;
    const stock = (await this.barcodes.getByLocation(locationId)).filter(
      (c) => c.status !== CartonStatus.Shipped && c.status !== CartonStatus.Inactive,
    );
    if (stock.length) {
      this.notify.error(`Bin ${loc.locationCode} masih berisi ${stock.length} karton.`);
      return false;
    }
    if (
      !(await this.confirmDanger('Hapus Bin', `Hapus bin ${loc.locationCode}?`))
    ) {
      return false;
    }
    await this.locSvc.remove(locationId);
    this.notify.success(`Bin ${loc.locationCode} dihapus.`);
    this.selectedLoc.set(null);
    this.locCartons.set([]);
    this.selectedCarton.set(null);
    return true;
  }

  selectCarton(c: CartonBarcode): void {
    this.selectedCarton.set(c);
  }

  async reloadMap(): Promise<void> {
    const data = await this.loadPohiData();
    this.engine?.setMap(data);
    this.notify.success('Denah dimuat ulang dari database.');
  }
}
