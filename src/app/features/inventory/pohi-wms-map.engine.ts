/**
 * Port fitur denah 3D dari Pohi.html — digabung ke WMS:
 * gedung = warehouse, lantai = floor, ruangan = bin.
 * Interaksi: drag gedung, putar, klik masuk, tarik grid untuk buat bin.
 */

export type PohiRoom = [
  string, // name
  number, // x
  number, // y
  number, // w
  number, // h
  string, // note / locationCode
  string?, // image
  number?, // applyImg
  unknown?,
  unknown?,
  unknown?,
  string?, // locationId
  number?, // capacity
];

export interface PohiFloor {
  id: string;
  n: string;
  t: string;
  r: PohiRoom[];
}

export interface PohiBuilding {
  id: string;
  n: string;
  t: string;
  x: number;
  y: number;
  rot: number;
  cols: number;
  rows: number;
  floors: PohiFloor[];
}

export interface PohiMapData {
  name: string;
  buildings: PohiBuilding[];
}

export interface PohiMapCallbacks {
  onCreateBuilding: (draft: {
    code: string;
    name: string;
    x: number;
    y: number;
  }) => Promise<{ building: PohiBuilding }>;
  onCreateFloor: (buildingId: string, draft: { code: string; name: string }) => Promise<PohiFloor>;
  onCreateRoom: (
    buildingId: string,
    floorId: string,
    room: PohiRoom,
  ) => Promise<{ locationId: string; room: PohiRoom }>;
  onUpdateBuilding: (buildingId: string, patch: Partial<PohiBuilding>) => Promise<void>;
  onUpdateFloor: (floorId: string, patch: Partial<PohiFloor>) => Promise<void>;
  onUpdateRoom: (
    buildingId: string,
    floorId: string,
    locationId: string,
    room: PohiRoom,
  ) => Promise<void>;
  onDeleteBuilding: (buildingId: string) => Promise<boolean>;
  onDeleteFloor: (buildingId: string, floorId: string) => Promise<boolean>;
  onDeleteRoom: (buildingId: string, floorId: string, locationId: string) => Promise<boolean>;
  onSelectRoom: (buildingId: string, floorId: string, locationId: string | null) => void;
  onHint: (text: string) => void;
}

const CELL = 40;
const GAP = 80;
const MAP_PAD = 2;
const ROOM_GAP = 4;

export class PohiWmsMapEngine {
  private view: 'map' | 'building' | 'floor' = 'map';
  private selBld = -1;
  private sel = -1;
  private selRoom = -1;
  private rz = -38;
  private H = 0;
  private bldEls: Array<{ wrap: HTMLElement; floors: HTMLElement[]; h: number; sw: number; sh: number }> =
    [];
  private els: HTMLElement[] = [];
  private drag = false;
  private moved = false;
  private sx = 0;
  private srz = 0;
  private drawing = false;
  private justDrew = false;
  private draft: HTMLElement | null = null;
  private ax = 0;
  private ay = 0;
  private lastRect: [number, number, number, number] = [0, 0, 1, 1];
  private lastBad = false;
  private gridDirty = false;
  private movingBld = -1;
  private bldMoved = false;
  private moveSX = 0;
  private moveSY = 0;
  private moveOrigX = 0;
  private moveOrigY = 0;
  private resizing = false;
  private resizeDir = '';
  private resizeOrig: [number, number, number, number] | null = null;
  private resizeIdx = -1;
  private drawScale = 1;
  private viewX = 0;
  private viewY = 0;
  private destroyed = false;

  private unsubs: Array<() => void> = [];

  constructor(
    private readonly scene: HTMLElement,
    private readonly stage: HTMLElement,
    private readonly panel: HTMLElement,
    private map: PohiMapData,
    private readonly cb: PohiMapCallbacks,
  ) {
    this.bindGlobal();
    this.showMap();
  }

  setMap(data: PohiMapData): void {
    this.map = data;
    if (this.view === 'map') this.showMap();
    else if (this.view === 'building' && this.selBld >= 0) this.showBuilding(this.selBld);
    else if (this.view === 'floor' && this.selBld >= 0 && this.sel >= 0) this.showFloor(this.sel);
    else this.showMap();
  }

  /** Deep-link dari master: fokususi warehouse / lantai / bin by id. */
  focusByIds(buildingId?: string | null, floorId?: string | null, locationId?: string | null): void {
    if (!buildingId) {
      this.showMap();
      return;
    }
    const bi = this.buildings().findIndex((b) => b.id === buildingId);
    if (bi < 0) {
      this.showMap();
      return;
    }
    if (!floorId) {
      this.showBuilding(bi);
      return;
    }
    const fi = this.buildings()[bi].floors.findIndex((f) => f.id === floorId);
    if (fi < 0) {
      this.showBuilding(bi);
      return;
    }
    this.selBld = bi;
    this.showFloor(fi);
    if (locationId) {
      const ri = this.buildings()[bi].floors[fi].r.findIndex((r) => r[11] === locationId);
      if (ri >= 0) {
        // rebuild async-ish: pick after floor DOM ada
        setTimeout(() => this.pick(ri), 0);
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.stage.innerHTML = '';
  }

  private buildings(): PohiBuilding[] {
    return this.map.buildings;
  }

  private curBld(): PohiBuilding | null {
    return this.selBld >= 0 ? this.map.buildings[this.selBld] : null;
  }

  private floors(): PohiFloor[] {
    const b = this.curBld();
    return b ? b.floors : [];
  }

  private normRot(r: number): number {
    return (((r || 0) % 360) + 360) % 360;
  }

  private towerH(bld: PohiBuilding): number {
    return Math.max(0, (bld.floors.length - 1) * GAP);
  }

  private overlaps(
    list: PohiRoom[],
    x: number,
    y: number,
    w: number,
    h: number,
    skip = -1,
  ): boolean {
    for (let i = 0; i < list.length; i++) {
      if (i === skip) continue;
      const r = list[i];
      if (x < r[1] + r[3] && x + w > r[1] && y < r[2] + r[4] && y + h > r[2]) return true;
    }
    return false;
  }

  private applyRoomGeom(el: HTMLElement, r: PohiRoom): void {
    const g = ROOM_GAP;
    el.style.left = r[1] * CELL + g + 'px';
    el.style.top = r[2] * CELL + g + 'px';
    el.style.width = Math.max(8, r[3] * CELL - g * 2) + 'px';
    el.style.height = Math.max(8, r[4] * CELL - g * 2) + 'px';
  }

  private gridSpan(list: PohiFloor[], c: number, r: number): [number, number] {
    let cols = c || 12;
    let rows = r || 8;
    for (const f of list) {
      for (const room of f.r) {
        cols = Math.max(cols, room[1] + room[3] + MAP_PAD);
        rows = Math.max(rows, room[2] + room[4] + MAP_PAD);
      }
    }
    return [Math.max(6, cols), Math.max(5, rows)];
  }

  private mapBounds(): { cols: number; rows: number } {
    let maxX = 20;
    let maxY = 14;
    for (const b of this.buildings()) {
      const fp = this.buildingFootprint(b);
      maxX = Math.max(maxX, (b.x || 0) + fp.w + 4);
      maxY = Math.max(maxY, (b.y || 0) + fp.h + 4);
    }
    return { cols: maxX, rows: maxY };
  }

  private buildingFootprint(b: PohiBuilding): { w: number; h: number } {
    const c = b.cols || 12;
    const r = b.rows || 8;
    const rot = this.normRot(b.rot);
    if (rot === 90 || rot === 270) return { w: r, h: c };
    return { w: c, h: r };
  }

  private applyBuildingRot(wrap: HTMLElement, bld: PohiBuilding): void {
    const sw = (bld.cols || 12) * CELL;
    const sh = (bld.rows || 8) * CELL;
    wrap.style.transformOrigin = `${sw / 2}px ${sh / 2}px`;
    wrap.style.transform = `rotateZ(${this.normRot(bld.rot)}deg)`;
  }

  private nextBuildingSlot(): [number, number] {
    let x = 0;
    let y = 0;
    const occupied = this.buildings().map((b) => {
      const fp = this.buildingFootprint(b);
      return { x: b.x || 0, y: b.y || 0, w: fp.w, h: fp.h };
    });
    outer: for (y = 0; y < 40; y += 10) {
      for (x = 0; x < 48; x += 12) {
        const clash = occupied.some(
          (o) => x < o.x + o.w + 2 && x + 10 > o.x && y < o.y + o.h + 2 && y + 8 > o.y,
        );
        if (!clash) break outer;
      }
    }
    return [x, y];
  }

  private mapScale(): number {
    const m = this.stage.style.transform.match(/scale\(([^)]+)\)/);
    return m ? parseFloat(m[1]) : 1;
  }

  /** Inverse yaw + foreshorten — sama seperti Pohi.html mapDragToGrid. */
  private mapDragToGrid(e: PointerEvent): [number, number] {
    const scale = this.mapScale() || 1;
    const ang = (this.rz * Math.PI) / 180;
    const foreshort = Math.max(0.35, Math.cos((58 * Math.PI) / 180));
    const dx = (e.clientX - this.moveSX) / scale;
    const dy = (e.clientY - this.moveSY) / scale;
    const ux = dx * Math.cos(ang) + dy * Math.sin(ang);
    const uy = (-dx * Math.sin(ang) + dy * Math.cos(ang)) / foreshort;
    return [
      Math.max(0, Math.round(this.moveOrigX + ux / CELL)),
      Math.max(0, Math.round(this.moveOrigY + uy / CELL)),
    ];
  }

  private placeBuilding(i: number, x: number, y: number, live: boolean): void {
    const b = this.buildings()[i];
    if (!b) return;
    b.x = Math.max(0, +x || 0);
    b.y = Math.max(0, +y || 0);
    const made = this.bldEls[i];
    if (made) {
      made.wrap.style.left = b.x * CELL + 'px';
      made.wrap.style.top = b.y * CELL + 'px';
    }
    if (!live) void this.cb.onUpdateBuilding(b.id, { x: b.x, y: b.y });
  }

  private rotateBuilding(i: number, dir: number): void {
    const b = this.buildings()[i];
    if (!b) return;
    b.rot = this.normRot((b.rot || 0) + dir * 90);
    void this.cb.onUpdateBuilding(b.id, { rot: b.rot });
    this.rebuild();
  }

  private gridPos(
    e: PointerEvent,
    el: HTMLElement,
    cols: number,
    rows: number,
    clamp: boolean,
  ): [number, number] {
    const b = el.getBoundingClientRect();
    const sx = b.width / (el.offsetWidth || 1);
    const sy = b.height / (el.offsetHeight || 1);
    const bl = parseFloat(getComputedStyle(el).borderLeftWidth) || 0;
    const bt = parseFloat(getComputedStyle(el).borderTopWidth) || 0;
    let x = Math.floor((e.clientX - b.left) / sx / CELL - bl / CELL);
    let y = Math.floor((e.clientY - b.top) / sy / CELL - bt / CELL);
    if (clamp) {
      x = Math.max(0, Math.min(cols - 1, x));
      y = Math.max(0, Math.min(rows - 1, y));
    }
    return [x, y];
  }

  private ensureGrid(px: number, py: number): [number, number] {
    const b = this.curBld();
    if (!b) return [0, 0];
    let cols = b.cols;
    let rows = b.rows;
    if (px >= cols - 1) {
      cols = px + 3;
      this.gridDirty = true;
    }
    if (py >= rows - 1) {
      rows = py + 3;
      this.gridDirty = true;
    }
    if (px < 0) px = 0;
    if (py < 0) py = 0;
    b.cols = Math.max(b.cols, cols);
    b.rows = Math.max(b.rows, rows);
    return [px, py];
  }

  private syncRoomHandles(el: HTMLElement): void {
    el.querySelectorAll('.rhandle').forEach((h) => h.remove());
    if (!el.classList.contains('sel')) return;
    for (const dir of ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e']) {
      const h = document.createElement('div');
      h.className = 'rhandle ' + dir;
      h.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        this.startResize(ev as PointerEvent, dir);
      });
      el.appendChild(h);
    }
  }

  private startResize(e: PointerEvent, dir: string): void {
    if (this.view !== 'floor' || this.selRoom < 0) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    this.resizing = true;
    this.resizeDir = dir;
    this.resizeIdx = this.selRoom;
    const room = this.floors()[this.sel].r[this.selRoom];
    this.resizeOrig = [room[1], room[2], room[3], room[4]];
    this.justDrew = true;
    this.lastBad = false;
    this.drawScale = this.mapScale();
    this.stage.style.transition = 'none';
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  private makeFloorEl(
    f: PohiFloor,
    fi: number,
    bld: PohiBuilding,
    interactiveFloor: boolean,
  ): HTMLElement {
    const d = document.createElement('div');
    d.className = 'floor';
    d.style.width = bld.cols * CELL + 'px';
    d.style.height = bld.rows * CELL + 'px';
    f.r.forEach((r, j) => {
      const e = document.createElement('div');
      e.className = 'room';
      this.applyRoomGeom(e, r);
      const lab = document.createElement('span');
      lab.className = 'rlab';
      lab.textContent = r[0];
      e.appendChild(lab);
      if (interactiveFloor) {
        e.onclick = (ev) => {
          if ((ev.target as HTMLElement).classList.contains('rhandle')) return;
          if (this.sel === fi && !this.justDrew && !this.resizing) {
            ev.stopPropagation();
            this.pick(j);
          }
        };
      }
      d.appendChild(e);
    });
    const nm = document.createElement('div');
    nm.className = 'name';
    nm.textContent = f.n + ' // ' + f.t.toUpperCase();
    d.appendChild(nm);
    return d;
  }

  private makeBuildingStack(
    bld: PohiBuilding,
    bi: number,
    mapMode: boolean,
  ): { wrap: HTMLElement; floors: HTMLElement[]; h: number; sw: number; sh: number } {
    const wrap = document.createElement('div');
    wrap.className = 'bld';
    const sw = bld.cols * CELL;
    const sh = bld.rows * CELL;
    const th = this.towerH(bld);
    wrap.style.width = sw + 'px';
    wrap.style.height = sh + 'px';
    if (mapMode) {
      wrap.style.left = (bld.x || 0) * CELL + 'px';
      wrap.style.top = (bld.y || 0) * CELL + 'px';
      this.applyBuildingRot(wrap, bld);
    } else {
      wrap.style.left = '0';
      wrap.style.top = '0';
      wrap.style.transform = '';
    }
    const lab = document.createElement('div');
    lab.className = 'label';
    lab.textContent = bld.n;
    wrap.appendChild(lab);
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent =
      bld.floors.length +
      ' lantai · ' +
      bld.floors.reduce((a, f) => a + f.r.length, 0) +
      ' bin';
    wrap.appendChild(meta);

    [
      [0, 0],
      [sw - 2, 0],
      [0, sh - 2],
      [sw - 2, sh - 2],
      [sw / 2, 0],
      [sw / 2, sh - 2],
      [0, sh / 2],
      [sw - 2, sh / 2],
    ].forEach((p) => {
      const c = document.createElement('div');
      c.className = 'col';
      c.style.cssText = `left:${p[0]}px;top:${p[1]}px;height:${th}px`;
      wrap.appendChild(c);
    });
    const ant = document.createElement('div');
    ant.className = 'col';
    ant.style.cssText = `left:${sw / 2}px;top:${sh / 2}px;height:${th + 90}px;width:2px`;
    wrap.appendChild(ant);

    const floorNodes: HTMLElement[] = [];
    bld.floors.forEach((f, fi) => {
      const d = this.makeFloorEl(f, fi, bld, this.view === 'floor');
      if (mapMode) {
        d.onclick = (ev) => {
          if (!this.moved && !this.bldMoved) {
            ev.stopPropagation();
            this.showBuilding(bi);
          }
        };
      } else if (this.view === 'building') {
        d.onclick = () => {
          if (!this.moved) this.showFloor(fi);
        };
      } else {
        d.addEventListener('pointerdown', (e) => this.startDraw(e as PointerEvent));
      }
      wrap.appendChild(d);
      floorNodes.push(d);
    });

    if (mapMode) {
      wrap.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button !== 0) return;
        e.stopPropagation();
        this.movingBld = bi;
        this.bldMoved = false;
        this.moved = false;
        this.moveSX = e.clientX;
        this.moveSY = e.clientY;
        this.moveOrigX = bld.x || 0;
        this.moveOrigY = bld.y || 0;
        wrap.classList.add('moving');
        try {
          wrap.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      });
      wrap.onclick = (e) => {
        e.stopPropagation();
        if (!this.bldMoved && !this.moved) this.showBuilding(bi);
      };
    }
    return { wrap, floors: floorNodes, h: th, sw, sh };
  }

  private rebuild(): void {
    if (this.destroyed) return;
    this.stage.innerHTML = '';
    this.bldEls = [];
    this.els = [];
    this.scene.classList.remove('mapview', 'bldview', 'focus');
    if (this.view === 'map') this.scene.classList.add('mapview');
    else if (this.view === 'building') this.scene.classList.add('bldview');
    else this.scene.classList.add('focus');

    if (this.view === 'map') {
      const bounds = this.mapBounds();
      const mw = bounds.cols * CELL;
      const mh = bounds.rows * CELL;
      this.stage.style.width = mw + 'px';
      this.stage.style.height = mh + 'px';
      const g = document.createElement('div');
      g.className = 'ground';
      g.style.cssText = `left:-80px;top:-80px;width:${mw + 160}px;height:${mh + 160}px;transform:translateZ(-30px)`;
      this.stage.appendChild(g);
      this.H = 0;
      this.buildings().forEach((bld, bi) => {
        const span = this.gridSpan(bld.floors, bld.cols || 12, bld.rows || 8);
        bld.cols = span[0];
        bld.rows = span[1];
        const made = this.makeBuildingStack(bld, bi, true);
        this.H = Math.max(this.H, made.h);
        this.stage.appendChild(made.wrap);
        this.bldEls.push(made);
      });
    } else {
      const b = this.curBld();
      if (!b) return;
      const span = this.gridSpan(b.floors, b.cols || 12, b.rows || 8);
      b.cols = span[0];
      b.rows = span[1];
      const made = this.makeBuildingStack(b, this.selBld, false);
      this.H = made.h;
      this.stage.style.width = made.sw + 'px';
      this.stage.style.height = made.sh + 'px';
      const g = document.createElement('div');
      g.className = 'ground';
      const padX = Math.round(made.sw * 0.25);
      const padY = Math.round(made.sh * 0.28);
      g.style.cssText = `left:${-padX}px;top:${-padY}px;width:${made.sw + padX * 2}px;height:${made.sh + padY * 2}px;transform:translateZ(-30px)`;
      this.stage.appendChild(g);
      this.stage.appendChild(made.wrap);
      this.bldEls = [made];
      this.els = made.floors;
    }
    this.layout();
    this.renderPanel();
  }

  private placeFocus(scale: number): void {
    this.stage.style.position = 'absolute';
    this.stage.style.transformOrigin = '0 0';
    this.stage.style.transform = `scale(${scale})`;
    this.stage.style.left = this.viewX + 'px';
    this.stage.style.top = this.viewY + 'px';
  }

  layout(): void {
    if (this.destroyed) return;
    const w = this.scene.clientWidth;
    const h = this.scene.clientHeight || 360;
    if (this.view === 'map') {
      this.stage.style.position = 'relative';
      this.stage.style.left = '';
      this.stage.style.top = '';
      this.stage.style.transformOrigin = 'center center';
      const sw = this.stage.offsetWidth || 480;
      const sh = this.stage.offsetHeight || 320;
      const s = Math.min(1.1, (w - 40) / (sw * 1.25), (h - 40) / (sh * 0.7 + this.H * 0.35 + 40));
      this.stage.style.transform = `scale(${s}) rotateX(58deg) rotateZ(${this.rz}deg) translateZ(${-this.H / 2}px)`;
      this.bldEls.forEach((made) => {
        made.floors.forEach((e, i) => {
          e.style.transform = `translateZ(${i * GAP}px)`;
          e.classList.remove('off');
        });
      });
    } else if (this.view === 'building') {
      const b = this.curBld();
      if (!b) return;
      const sw = b.cols * CELL;
      const sh = b.rows * CELL;
      this.stage.style.position = 'relative';
      this.stage.style.left = '';
      this.stage.style.top = '';
      this.stage.style.transformOrigin = 'center center';
      const s = Math.min(1.2, (w - 40) / (sw * 1.35), (h - 40) / (sh * 0.62 + 70));
      this.stage.style.transform = `scale(${s}) rotateX(60deg) rotateZ(${this.rz}deg) translateZ(${-this.H / 2}px)`;
      this.els.forEach((e, i) => {
        e.style.transform = `translateZ(${i * GAP}px)`;
        e.classList.remove('off');
      });
    } else if (this.drawing || this.resizing) {
      this.placeFocus(this.drawScale);
      this.els.forEach((e, i) => {
        e.style.transform = 'translateZ(0)';
        e.classList.toggle('off', i !== this.sel);
      });
    } else {
      const b2 = this.curBld();
      if (!b2) return;
      const sw2 = b2.cols * CELL;
      const sh2 = b2.rows * CELL;
      const s2 = Math.min(1.5, (w - 24) / sw2, (h - 24) / sh2);
      this.viewX = (w - sw2 * s2) / 2;
      this.viewY = (h - sh2 * s2) / 2;
      this.drawScale = s2;
      this.placeFocus(s2);
      this.els.forEach((e, i) => {
        e.style.transform = 'translateZ(0)';
        e.classList.toggle('off', i !== this.sel);
      });
    }
  }

  showMap(): void {
    this.view = 'map';
    this.selBld = -1;
    this.sel = -1;
    this.selRoom = -1;
    this.drawing = false;
    this.scene.classList.remove('focus');
    this.cb.onHint(
      '> Tarik gedung untuk pindah. Putar kiri/kanan di panel. Klik tanpa geser untuk masuk.',
    );
    this.cb.onSelectRoom('', '', null);
    this.rebuild();
  }

  showBuilding(i: number): void {
    if (i < 0 || i >= this.buildings().length) return;
    this.view = 'building';
    this.selBld = i;
    this.sel = -1;
    this.selRoom = -1;
    this.drawing = false;
    this.scene.classList.remove('focus');
    this.cb.onHint('> Geser untuk memutar. Klik lantai untuk edit denah bin.');
    this.cb.onSelectRoom(this.buildings()[i].id, '', null);
    this.rebuild();
  }

  showFloor(i: number): void {
    const list = this.floors();
    if (i < 0 || i >= list.length) return;
    this.view = 'floor';
    this.sel = i;
    this.selRoom = -1;
    this.drawing = false;
    this.scene.classList.add('focus');
    this.cb.onHint('> Tarik di grid kosong untuk menambah bin. Pilih bin lalu geser sudut putih untuk ubah ukuran.');
    const b = this.curBld();
    if (b) this.cb.onSelectRoom(b.id, list[i].id, null);
    this.rebuild();
  }

  private pick(j: number): void {
    this.selRoom = this.selRoom === j ? -1 : j;
    const b = this.curBld();
    const f = this.floors()[this.sel];
    const room = this.selRoom >= 0 ? f?.r[this.selRoom] : null;
    if (b && f) this.cb.onSelectRoom(b.id, f.id, room?.[11] ?? null);
    this.renderPanel();
    if (this.els[this.sel]) {
      this.els[this.sel].querySelectorAll('.room').forEach((el, idx) => {
        if (el.classList.contains('draft')) return;
        el.classList.toggle('sel', idx === this.selRoom);
        this.syncRoomHandles(el as HTMLElement);
      });
    }
  }

  private startDraw(e: PointerEvent): void {
    if (this.view !== 'floor' || this.sel < 0 || this.resizing) return;
    const t = e.target as HTMLElement;
    if (
      t.classList.contains('room') ||
      t.classList.contains('rhandle') ||
      t.classList.contains('rlab') ||
      t.closest('.rhandle')
    ) {
      return;
    }
    if (e.button != null && e.button !== 0) return;
    const floorEl = this.els[this.sel];
    const b = this.curBld();
    if (!floorEl || !b) return;
    e.stopPropagation();
    e.preventDefault();
    const p = this.gridPos(e, floorEl, b.cols, b.rows, true);
    this.ax = p[0];
    this.ay = p[1];
    this.drawing = true;
    this.drawScale = this.mapScale();
    this.lastRect = [p[0], p[1], 1, 1];
    this.lastBad = this.overlaps(this.floors()[this.sel].r, p[0], p[1], 1, 1);
    this.stage.style.transition = 'none';
    this.paintDraft();
  }

  private paintDraft(): void {
    if (this.draft) this.draft.remove();
    const floorEl = this.els[this.sel];
    if (!floorEl) return;
    this.draft = document.createElement('div');
    this.draft.className = 'room draft' + (this.lastBad ? ' bad' : '');
    this.applyRoomGeom(this.draft, [
      '',
      this.lastRect[0],
      this.lastRect[1],
      this.lastRect[2],
      this.lastRect[3],
      '',
    ]);
    floorEl.appendChild(this.draft);
  }

  async addBuilding(): Promise<void> {
    const [x, y] = this.nextBuildingSlot();
    const n = this.buildings().length + 1;
    const { building } = await this.cb.onCreateBuilding({
      code: `WH${String(n).padStart(2, '0')}`,
      name: `Warehouse ${n}`,
      x,
      y,
    });
    this.map.buildings.push(building);
    this.showMap();
  }

  async addFloor(): Promise<void> {
    const b = this.curBld();
    if (!b) return;
    const n = b.floors.length + 1;
    const code = n < 10 ? `LV.0${n}` : `LV.${n}`;
    const fl = await this.cb.onCreateFloor(b.id, {
      code,
      name: `Lantai ${n}`,
    });
    b.floors.push(fl);
    this.showBuilding(this.selBld);
  }

  private async commitDrawnRoom(): Promise<void> {
    const b = this.curBld();
    const f = this.floors()[this.sel];
    if (!b || !f || this.lastBad) return;
    const name = `Bin ${f.r.length + 1}`;
    const room: PohiRoom = [
      name,
      this.lastRect[0],
      this.lastRect[1],
      this.lastRect[2],
      this.lastRect[3],
      '',
    ];
    const created = await this.cb.onCreateRoom(b.id, f.id, room);
    f.r.push(created.room);
    this.selRoom = f.r.length - 1;
    this.justDrew = true;
    this.rebuild();
    setTimeout(() => {
      this.justDrew = false;
    }, 0);
  }

  private renderPanel(): void {
    const esc = (s: unknown) =>
      String(s ?? '').replace(/[&<>"]/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
      );

    if (this.view === 'map') {
      this.panel.innerHTML =
        `<h2>Map · ${esc(this.map.name)}</h2>` +
        `<p class="fine">Tarik gedung untuk pindah. Putar agar saling berhadapan. Klik tanpa geser untuk masuk.</p>` +
        `<div class="tools"><button type="button" id="pAddBld">+ WAREHOUSE</button></div>` +
        `<h2>Warehouse</h2><div class="list">` +
        this.buildings()
          .map((bld, i) => {
            return (
              `<div class="item" data-b="${i}"><b>${esc(bld.n)}</b>${esc(bld.t)}` +
              `<small>${bld.floors.length} lantai · ${bld.floors.reduce((a, f) => a + f.r.length, 0)} bin · ${bld.x},${bld.y} · ${this.normRot(bld.rot)}°</small>` +
              `<div class="posrow" data-stop="1">` +
              `<button type="button" data-rl="${i}">↺</button>` +
              `<span>${this.normRot(bld.rot)}°</span>` +
              `<button type="button" data-rr="${i}">↻</button>` +
              `<button type="button" data-del-b="${i}" title="Hapus warehouse">🗑</button>` +
              `</div></div>`
            );
          })
          .join('') +
        `</div>`;
      this.panel.querySelector('#pAddBld')?.addEventListener('click', () => void this.addBuilding());
      this.panel.querySelectorAll('[data-b]').forEach((el) => {
        el.addEventListener('click', (ev) => {
          if ((ev.target as HTMLElement).closest('[data-stop]')) return;
          this.showBuilding(+((el as HTMLElement).dataset['b'] || -1));
        });
      });
      this.panel.querySelectorAll('[data-rl]').forEach((el) => {
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.rotateBuilding(+((el as HTMLElement).dataset['rl'] || -1), -1);
        });
      });
      this.panel.querySelectorAll('[data-rr]').forEach((el) => {
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.rotateBuilding(+((el as HTMLElement).dataset['rr'] || -1), 1);
        });
      });
      this.panel.querySelectorAll('[data-del-b]').forEach((el) => {
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          void this.deleteBuilding(+((el as HTMLElement).dataset['delB'] || -1));
        });
      });
      return;
    }

    const b = this.curBld();
    if (!b) return;

    if (this.view === 'building') {
      this.panel.innerHTML =
        `<h2>Warehouse</h2>` +
        `<input id="bldName" value="${esc(b.n)}">` +
        `<input id="bldTitle" value="${esc(b.t)}">` +
        `<div class="tools">` +
        `<button type="button" id="pBackMap">← SEMUA WAREHOUSE</button>` +
        `<button type="button" id="pAddFloor">+ LANTAI</button>` +
        `<button type="button" id="pDelBld">HAPUS WAREHOUSE</button>` +
        `</div>` +
        `<h2>Lantai</h2><div class="list">` +
        b.floors
          .map(
            (f, i) =>
              `<div class="item" data-f="${i}"><b>${esc(f.n)}</b>${esc(f.t)}<small>${f.r.length} bin</small>` +
              `<div class="posrow" data-stop="1"><button type="button" data-del-f="${i}">Hapus lantai</button></div></div>`,
          )
          .reverse()
          .join('') +
        `</div>`;
      this.panel.querySelector('#pBackMap')?.addEventListener('click', () => this.showMap());
      this.panel.querySelector('#pAddFloor')?.addEventListener('click', () => void this.addFloor());
      this.panel.querySelector('#pDelBld')?.addEventListener('click', () => void this.deleteBuilding(this.selBld));
      const name = this.panel.querySelector('#bldName') as HTMLInputElement | null;
      const title = this.panel.querySelector('#bldTitle') as HTMLInputElement | null;
      name?.addEventListener('change', () => {
        b.n = name.value;
        void this.cb.onUpdateBuilding(b.id, { n: b.n });
        this.rebuild();
      });
      title?.addEventListener('change', () => {
        b.t = title.value;
        void this.cb.onUpdateBuilding(b.id, { t: b.t });
      });
      this.panel.querySelectorAll('[data-f]').forEach((el) => {
        el.addEventListener('click', (ev) => {
          if ((ev.target as HTMLElement).closest('[data-stop]')) return;
          this.showFloor(+((el as HTMLElement).dataset['f'] || -1));
        });
      });
      this.panel.querySelectorAll('[data-del-f]').forEach((el) => {
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          void this.deleteFloor(+((el as HTMLElement).dataset['delF'] || -1));
        });
      });
      return;
    }

    const f = this.floors()[this.sel];
    const room = this.selRoom >= 0 ? f.r[this.selRoom] : null;
    this.panel.innerHTML =
      `<h2>Lantai · ${esc(b.n)}</h2>` +
      `<div class="tools">` +
      `<button type="button" id="pBackBld">← SEMUA LANTAI</button>` +
      `<button type="button" id="pBackMap2">MAP</button>` +
      `<button type="button" id="pAddFloor2">+ LANTAI</button>` +
      `<button type="button" id="pDelFloor">HAPUS LANTAI</button>` +
      `</div>` +
      `<input id="floorCode" value="${esc(f.n)}">` +
      `<input id="floorTitle" value="${esc(f.t)}">` +
      `<p class="fine">Tarik di denah kosong untuk buat bin baru. Kapasitas bisa diisi setelah bin dipilih.</p>` +
      (room
        ? `<h2>Bin terpilih</h2>` +
          `<input id="roomName" value="${esc(room[0])}" placeholder="Nama bin">` +
          `<input id="roomNote" value="${esc(room[5] || '')}" placeholder="Kode / catatan">` +
          `<label class="fine">Kapasitas (karton)</label>` +
          `<input id="roomCap" type="number" min="0" value="${esc(room[12] ?? 50)}">` +
          `<div class="tools"><button type="button" id="pDelRoom">HAPUS BIN</button></div>` +
          `<p class="fine">Grid ${room[1]},${room[2]} · ${room[3]}×${room[4]} · geser sudut putih untuk resize</p>`
        : '') +
      `<h2>${esc(f.n)} // ${esc(f.t)}</h2><div class="list">` +
      f.r
        .map(
          (r, j) =>
            `<div class="item${j === this.selRoom ? ' sel' : ''}" data-r="${j}"><b>${esc(r[0])}</b>` +
            `<small>${esc(r[5] || '—')} · cap ${r[12] ?? '—'}</small></div>`,
        )
        .join('') +
      `</div>`;

    this.panel.querySelector('#pBackBld')?.addEventListener('click', () => this.showBuilding(this.selBld));
    this.panel.querySelector('#pBackMap2')?.addEventListener('click', () => this.showMap());
    this.panel.querySelector('#pAddFloor2')?.addEventListener('click', () => void this.addFloor());
    this.panel.querySelector('#pDelFloor')?.addEventListener('click', () => void this.deleteFloor(this.sel));
    const floorCode = this.panel.querySelector('#floorCode') as HTMLInputElement | null;
    const floorTitle = this.panel.querySelector('#floorTitle') as HTMLInputElement | null;
    floorCode?.addEventListener('change', () => {
      f.n = floorCode.value;
      void this.cb.onUpdateFloor(f.id, { n: f.n });
      this.rebuild();
    });
    floorTitle?.addEventListener('change', () => {
      f.t = floorTitle.value;
      void this.cb.onUpdateFloor(f.id, { t: f.t });
      this.rebuild();
    });
    if (room) {
      const roomName = this.panel.querySelector('#roomName') as HTMLInputElement | null;
      const roomNote = this.panel.querySelector('#roomNote') as HTMLInputElement | null;
      const roomCap = this.panel.querySelector('#roomCap') as HTMLInputElement | null;
      const persistRoom = () => {
        if (room[11]) void this.cb.onUpdateRoom(b.id, f.id, room[11], room);
      };
      roomName?.addEventListener('change', () => {
        room[0] = roomName.value;
        persistRoom();
        this.rebuild();
      });
      roomNote?.addEventListener('change', () => {
        room[5] = roomNote.value;
        persistRoom();
      });
      roomCap?.addEventListener('change', () => {
        room[12] = Math.max(0, Number(roomCap.value) || 0);
        persistRoom();
        this.renderPanel();
      });
      this.panel.querySelector('#pDelRoom')?.addEventListener('click', () => void this.deleteRoom(this.selRoom));
    }
    this.panel.querySelectorAll('[data-r]').forEach((el) => {
      el.addEventListener('click', () => this.pick(+((el as HTMLElement).dataset['r'] || -1)));
    });
    if (this.els[this.sel]) {
      this.els[this.sel].querySelectorAll('.room').forEach((el, j) => {
        if (el.classList.contains('draft')) return;
        el.classList.toggle('sel', j === this.selRoom);
        this.syncRoomHandles(el as HTMLElement);
      });
    }
  }

  private async deleteBuilding(i: number): Promise<void> {
    const b = this.buildings()[i];
    if (!b) return;
    const ok = await this.cb.onDeleteBuilding(b.id);
    if (!ok) return;
    this.map.buildings.splice(i, 1);
    this.showMap();
  }

  private async deleteFloor(i: number): Promise<void> {
    const b = this.curBld();
    if (!b || i < 0 || i >= b.floors.length) return;
    const f = b.floors[i];
    const ok = await this.cb.onDeleteFloor(b.id, f.id);
    if (!ok) return;
    b.floors.splice(i, 1);
    if (!b.floors.length) {
      this.showBuilding(this.selBld);
      return;
    }
    this.showBuilding(this.selBld);
  }

  private async deleteRoom(j: number): Promise<void> {
    const b = this.curBld();
    const f = this.floors()[this.sel];
    if (!b || !f || j < 0 || j >= f.r.length) return;
    const room = f.r[j];
    if (!room[11]) return;
    const ok = await this.cb.onDeleteRoom(b.id, f.id, room[11]);
    if (!ok) return;
    f.r.splice(j, 1);
    this.selRoom = -1;
    this.rebuild();
  }

  private bindGlobal(): void {
    const onDown = (e: PointerEvent) => {
      if (this.view === 'floor') return;
      if (this.view === 'map' && (e.target as HTMLElement).closest('.bld')) return;
      this.drag = true;
      this.moved = false;
      this.sx = e.clientX;
      this.srz = this.rz;
    };
    const onMove = (e: PointerEvent) => {
      if (this.movingBld >= 0) {
        const p = this.mapDragToGrid(e);
        if (p[0] !== this.moveOrigX || p[1] !== this.moveOrigY) this.bldMoved = true;
        this.placeBuilding(this.movingBld, p[0], p[1], true);
        return;
      }
      if (this.resizing) {
        this.stage.style.transition = 'none';
        const b = this.curBld();
        if (!b || !this.els[this.sel] || !this.resizeOrig) return;
        const room = this.floors()[this.sel].r[this.resizeIdx];
        let p = this.gridPos(e, this.els[this.sel], b.cols, b.rows, false);
        p = this.ensureGrid(p[0], p[1]);
        const [ox, oy, ow, oh] = this.resizeOrig;
        const right = ox + ow - 1;
        const bottom = oy + oh - 1;
        let x = ox;
        let y = oy;
        let w = ow;
        let h = oh;
        if (this.resizeDir.includes('e')) w = Math.max(1, p[0] - ox + 1);
        if (this.resizeDir.includes('s')) h = Math.max(1, p[1] - oy + 1);
        if (this.resizeDir.includes('w')) {
          x = Math.min(p[0], right);
          w = right - x + 1;
        }
        if (this.resizeDir.includes('n')) {
          y = Math.min(p[1], bottom);
          h = bottom - y + 1;
        }
        this.lastBad = this.overlaps(this.floors()[this.sel].r, x, y, w, h, this.resizeIdx);
        room[1] = x;
        room[2] = y;
        room[3] = w;
        room[4] = h;
        const el = this.els[this.sel].querySelectorAll('.room')[this.resizeIdx] as HTMLElement;
        if (el) {
          this.applyRoomGeom(el, room);
          el.classList.toggle('bad', this.lastBad);
        }
        return;
      }
      if (this.drawing) {
        this.stage.style.transition = 'none';
        const b = this.curBld();
        if (!b || !this.els[this.sel]) return;
        let p = this.gridPos(e, this.els[this.sel], b.cols, b.rows, false);
        p = this.ensureGrid(p[0], p[1]);
        const x = Math.min(this.ax, p[0]);
        const y = Math.min(this.ay, p[1]);
        const w = Math.abs(p[0] - this.ax) + 1;
        const h = Math.abs(p[1] - this.ay) + 1;
        this.lastRect = [x, y, w, h];
        this.lastBad = this.overlaps(this.floors()[this.sel].r, x, y, w, h);
        this.paintDraft();
        return;
      }
      if (!this.drag) return;
      const dx = e.clientX - this.sx;
      if (Math.abs(dx) > 4) this.moved = true;
      if (this.moved) {
        this.rz = this.srz + dx * 0.4;
        this.stage.style.transition = 'none';
        this.layout();
      }
    };
    const onUp = () => {
      if (this.movingBld >= 0) {
        const i = this.movingBld;
        this.bldEls[i]?.wrap.classList.remove('moving');
        const b = this.buildings()[i];
        if (b) void this.cb.onUpdateBuilding(b.id, { x: b.x, y: b.y });
        this.movingBld = -1;
        if (this.bldMoved) this.rebuild();
        setTimeout(() => {
          this.bldMoved = false;
        }, 0);
        return;
      }
      if (this.resizing) {
        const room = this.floors()[this.sel]?.r[this.resizeIdx];
        const b = this.curBld();
        const f = this.floors()[this.sel];
        const el = this.els[this.sel]?.querySelectorAll('.room')[this.resizeIdx] as
          | HTMLElement
          | undefined;
        if (this.lastBad && this.resizeOrig && room) {
          room[1] = this.resizeOrig[0];
          room[2] = this.resizeOrig[1];
          room[3] = this.resizeOrig[2];
          room[4] = this.resizeOrig[3];
          if (el) this.applyRoomGeom(el, room);
        } else if (room && b && f && room[11]) {
          void this.cb.onUpdateRoom(b.id, f.id, room[11], room);
        }
        el?.classList.remove('bad');
        this.resizing = false;
        this.resizeDir = '';
        this.resizeOrig = null;
        this.resizeIdx = -1;
        this.stage.style.transition = '';
        if (el) this.syncRoomHandles(el);
        setTimeout(() => {
          this.justDrew = false;
        }, 0);
        return;
      }
      if (this.drawing) {
        this.draft?.remove();
        this.draft = null;
        this.drawing = false;
        this.stage.style.transition = '';
        if (!this.lastBad) void this.commitDrawnRoom();
        else this.layout();
        return;
      }
      this.drag = false;
      this.stage.style.transition = '';
      setTimeout(() => {
        this.moved = false;
      }, 0);
    };
    const onResize = () => this.layout();

    this.scene.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('resize', onResize);
    this.unsubs.push(
      () => this.scene.removeEventListener('pointerdown', onDown),
      () => window.removeEventListener('pointermove', onMove),
      () => window.removeEventListener('pointerup', onUp),
      () => window.removeEventListener('resize', onResize),
    );
  }
}
