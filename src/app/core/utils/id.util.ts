export function createId(prefix = ''): string {
  const rand = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${rand}` : rand;
}

export function padSequence(num: number, size = 6): string {
  return String(num).padStart(size, '0');
}
