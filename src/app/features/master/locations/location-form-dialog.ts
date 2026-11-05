import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { LocationType, MasterStatus } from '../../../core/enums';
import { LocationBin, Warehouse, WarehouseFloor } from '../../../core/models';
import { LocationStorageService } from '../../../core/services/location-storage.service';
import { NotificationService } from '../../../core/services/notification.service';
import { WarehouseFloorService } from '../../../core/services/warehouse-floor.service';
import { WarehouseStorageService } from '../../../core/services/warehouse-storage.service';

@Component({
  selector: 'app-location-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit Location' : 'Tambah Location' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Location Code</mat-label>
          <input matInput formControlName="locationCode" class="mono" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Location Name</mat-label>
          <input matInput formControlName="locationName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Warehouse</mat-label>
          <mat-select formControlName="warehouseId">
            @for (w of warehouses; track w.id) {
              <mat-option [value]="w.id">{{ w.warehouseCode }} — {{ w.warehouseName }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Lantai</mat-label>
          <mat-select formControlName="floorId">
            @for (f of floors; track f.id) {
              <mat-option [value]="f.id">{{ f.floorCode }} — {{ f.floorName }}</mat-option>
            }
          </mat-select>
          @if (!floors.length && form.controls.warehouseId.value) {
            <mat-hint>Warehouse belum punya lantai — akan dibuat LV.01 saat simpan.</mat-hint>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Type</mat-label>
          <mat-select formControlName="locationType">
            @for (t of types; track t) {
              <mat-option [value]="t">{{ t }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Capacity</mat-label>
          <input matInput type="number" formControlName="capacity" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ s }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Batal</button>
      <button mat-flat-button class="btn-copper" type="button" [disabled]="form.invalid || saving" (click)="save()">
        Simpan
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form-grid {
      display: grid;
      gap: 0.25rem;
      min-width: min(460px, 80vw);
      padding-top: 0.35rem;
    }
  `,
})
export class LocationFormDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly storage = inject(LocationStorageService);
  private readonly warehousesSvc = inject(WarehouseStorageService);
  private readonly floorSvc = inject(WarehouseFloorService);
  private readonly notify = inject(NotificationService);
  private readonly ref = inject(MatDialogRef<LocationFormDialog, boolean>);
  readonly data = inject<LocationBin | null>(MAT_DIALOG_DATA);

  warehouses: Warehouse[] = [];
  floors: WarehouseFloor[] = [];
  readonly types = Object.values(LocationType);
  readonly statuses = Object.values(MasterStatus);
  saving = false;

  readonly form = this.fb.nonNullable.group({
    locationCode: [this.data?.locationCode ?? '', Validators.required],
    locationName: [this.data?.locationName ?? '', Validators.required],
    warehouseId: [this.data?.warehouseId ?? '', Validators.required],
    floorId: [this.data?.floorId ?? ''],
    locationType: [this.data?.locationType ?? LocationType.Bin, Validators.required],
    capacity: [this.data?.capacity ?? 50],
    status: [this.data?.status ?? MasterStatus.Active, Validators.required],
  });

  async ngOnInit(): Promise<void> {
    this.warehouses = await this.warehousesSvc.getActive();
    const whId = this.form.controls.warehouseId.value;
    if (whId) await this.loadFloors(whId);
    this.form.controls.warehouseId.valueChanges.subscribe((id) => {
      void this.loadFloors(id);
    });
  }

  private async loadFloors(warehouseId: string): Promise<void> {
    if (!warehouseId) {
      this.floors = [];
      this.form.controls.floorId.setValue('');
      return;
    }
    this.floors = await this.floorSvc.getByWarehouse(warehouseId);
    const current = this.form.controls.floorId.value;
    if (current && this.floors.some((f) => f.id === current)) return;
    this.form.controls.floorId.setValue(this.floors[0]?.id ?? '');
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.saving = true;
    try {
      const v = this.form.getRawValue();
      const wh = this.warehouses.find((w) => w.id === v.warehouseId);
      if (!wh) throw new Error('Warehouse tidak valid.');

      let floor = this.floors.find((f) => f.id === v.floorId);
      if (!floor) {
        floor = await this.floorSvc.ensureDefaultFloor(wh.id, wh.warehouseCode);
      }

      const payload = {
        locationCode: v.locationCode,
        locationName: v.locationName,
        warehouseId: wh.id,
        warehouseCode: wh.warehouseCode,
        floorId: floor.id,
        floorCode: floor.floorCode,
        zone: floor.floorCode,
        locationType: v.locationType,
        capacity: v.capacity || undefined,
        status: v.status,
      };
      if (this.data) {
        await this.storage.update(this.data.id, payload);
        this.notify.success('Location diperbarui.');
      } else {
        await this.storage.create(payload);
        this.notify.success('Location ditambahkan.');
      }
      this.ref.close(true);
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : 'Gagal menyimpan.');
    } finally {
      this.saving = false;
    }
  }
}
