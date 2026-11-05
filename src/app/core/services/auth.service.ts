import { Injectable, computed, signal } from '@angular/core';

export type DemoUserCategory = 'admin' | 'supervisor' | 'staff';

export interface DemoUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  initials: string;
  division: string;
  category: DemoUserCategory;
  phone?: string;
  avatarTone?: string;
  blurb?: string;
}

const SESSION_KEY = 'kartondock.session';
const PENDING_KEY = 'kartondock.pendingOtp';
export const DEMO_OTP = '246810';

export const DEMO_USERS: DemoUser[] = [
  {
    id: 'u-admin',
    email: 'admin@kartondock.demo',
    password: 'password123',
    name: 'Andi Wijaya',
    role: 'Warehouse Admin',
    initials: 'AW',
    division: 'Operations Control',
    category: 'admin',
    phone: '0812-1000-0001',
    avatarTone: '#1a3a5c',
    blurb: 'Akses penuh master data, inbound/outbound, inventory, dan konfigurasi demo.',
  },
  {
    id: 'u-sup',
    email: 'supervisor@kartondock.demo',
    password: 'password123',
    name: 'Budi Hartawan',
    role: 'Shift Supervisor',
    initials: 'BH',
    division: 'Outbound & Adjustment',
    category: 'supervisor',
    phone: '0812-1000-0002',
    avatarTone: '#8a5a12',
    blurb: 'Supervisi shift outbound, adjustment lokasi/qty, dan monitoring alert stok.',
  },
  {
    id: 'u-op',
    email: 'operator@kartondock.demo',
    password: 'password123',
    name: 'Sari Lestari',
    role: 'Warehouse Operator',
    initials: 'SL',
    division: 'Inbound & Putaway',
    category: 'staff',
    phone: '0812-1000-0003',
    avatarTone: '#1f6b4a',
    blurb: 'Eksekusi inbound, putaway, scan barcode karton, dan update lokasi stok.',
  },
  {
    id: 'u-pick',
    email: 'picker@kartondock.demo',
    password: 'password123',
    name: 'Reza Firmansyah',
    role: 'Picker',
    initials: 'RF',
    division: 'Picking & Dispatch',
    category: 'staff',
    phone: '0812-1000-0004',
    avatarTone: '#3d5a80',
    blurb: 'Picking outbound berbasis barcode karton dan konfirmasi dispatch.',
  },
  {
    id: 'u-qa',
    email: 'qa@kartondock.demo',
    password: 'password123',
    name: 'Nina Kusuma',
    role: 'Inventory QA',
    initials: 'NK',
    division: 'Quality & Cycle Count',
    category: 'supervisor',
    phone: '0812-1000-0005',
    avatarTone: '#6b3fa0',
    blurb: 'Cycle count, barcode tracking, dan audit selisih stok karton.',
  },
];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSignal = signal<DemoUser | null>(this.readSession());
  private readonly pendingSignal = signal<DemoUser | null>(this.readPending());

  readonly user = this.userSignal.asReadonly();
  readonly pendingUser = this.pendingSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.userSignal());
  readonly hasPendingOtp = computed(() => !!this.pendingSignal());

  beginLogin(email: string, password: string): DemoUser {
    const found = DEMO_USERS.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
    );
    if (!found) throw new Error('Email atau kata sandi tidak valid.');
    this.setPending(found);
    return found;
  }

  beginLoginAs(user: DemoUser): DemoUser {
    this.setPending(user);
    return user;
  }

  verifyOtp(code: string, remember = true): DemoUser {
    const pending = this.pendingSignal();
    if (!pending) throw new Error('Sesi OTP tidak ditemukan. Masuk ulang.');
    if (code.trim() !== DEMO_OTP) throw new Error('Kode OTP tidak valid.');
    this.clearPending();
    this.persist(pending, remember);
    this.userSignal.set(pending);
    return pending;
  }

  cancelOtp(): void {
    this.clearPending();
  }

  updateProfile(patch: Partial<Pick<DemoUser, 'name' | 'phone' | 'avatarTone' | 'initials'>>): DemoUser {
    const current = this.userSignal();
    if (!current) throw new Error('Belum masuk.');
    const next = { ...current, ...patch };
    if (patch.name) {
      next.initials = patch.initials || initialsFrom(patch.name);
    }
    const idx = DEMO_USERS.findIndex((u) => u.id === current.id);
    if (idx >= 0) Object.assign(DEMO_USERS[idx], next);
    this.persist(next, true);
    this.userSignal.set(next);
    return next;
  }

  changePassword(currentPassword: string, nextPassword: string): void {
    const user = this.userSignal();
    if (!user) throw new Error('Belum masuk.');
    if (user.password !== currentPassword) throw new Error('Kata sandi saat ini salah.');
    if (nextPassword.length < 6) throw new Error('Kata sandi minimal 6 karakter.');
    user.password = nextPassword;
    const idx = DEMO_USERS.findIndex((u) => u.id === user.id);
    if (idx >= 0) DEMO_USERS[idx].password = nextPassword;
    this.persist(user, true);
    this.userSignal.set({ ...user });
  }

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    this.clearPending();
    this.userSignal.set(null);
  }

  private setPending(user: DemoUser): void {
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        initials: user.initials,
        division: user.division,
        category: user.category,
        phone: user.phone,
        avatarTone: user.avatarTone,
      }),
    );
    this.pendingSignal.set(user);
  }

  private clearPending(): void {
    sessionStorage.removeItem(PENDING_KEY);
    this.pendingSignal.set(null);
  }

  private persist(user: DemoUser, remember: boolean): void {
    const payload = JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      initials: user.initials,
      division: user.division,
      category: user.category,
      phone: user.phone,
      avatarTone: user.avatarTone,
    });
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (remember) localStorage.setItem(SESSION_KEY, payload);
    else sessionStorage.setItem(SESSION_KEY, payload);
  }

  private readSession(): DemoUser | null {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as DemoUser;
      const full = DEMO_USERS.find((u) => u.id === parsed.id);
      return full ? { ...full, ...parsed, password: full.password } : { ...parsed, password: '' };
    } catch {
      return null;
    }
  }

  private readPending(): DemoUser | null {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as DemoUser;
      const full = DEMO_USERS.find((u) => u.id === parsed.id);
      return full ?? { ...parsed, password: 'password123', category: parsed.category || 'staff' };
    } catch {
      return null;
    }
  }
}

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
