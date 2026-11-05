export interface ShortcutItem {
  label: string;
  keys: string[];
}

export const APP_SHORTCUTS: ShortcutItem[] = [
  { label: 'Buka pintasan keyboard', keys: ['?'] },
  { label: 'Ke beranda', keys: ['g', 'd'] },
  { label: 'Ke notifikasi', keys: ['g', 'n'] },
  { label: 'Ke inbound', keys: ['g', 'i'] },
  { label: 'Ke outbound', keys: ['g', 'o'] },
  { label: 'Ke adjustment', keys: ['g', 'm'] },
  { label: 'Ke inventory summary', keys: ['g', 's'] },
  { label: 'Ke inventory detail', keys: ['g', 'v'] },
  { label: 'Ke barcode tracking', keys: ['g', 'b'] },
  { label: 'Ke reports', keys: ['g', 'r'] },
  { label: 'Ke demo data', keys: ['g', 't'] },
];
