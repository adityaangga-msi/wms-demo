import { Injectable } from '@angular/core';
import { db } from '../db/wms-database';
import { DocPrefix } from '../enums';
import { padSequence } from '../utils/id.util';
import { todayKey } from '../utils/date.util';

@Injectable({ providedIn: 'root' })
export class DocumentNumberService {
  async nextDocument(prefix: DocPrefix): Promise<string> {
    const day = todayKey();
    const key = `${prefix}-${day}`;
    return db.transaction('rw', db.counters, async () => {
      const existing = await db.counters.where('key').equals(key).first();
      const next = (existing?.value ?? 0) + 1;
      if (existing) {
        await db.counters.update(existing.id, { value: next });
      } else {
        await db.counters.add({ id: key, key, value: next });
      }
      return `${prefix}-${day}-${padSequence(next, 4)}`;
    });
  }

  async nextCartonBarcodes(count: number): Promise<string[]> {
    if (count <= 0) return [];
    const key = DocPrefix.Carton;
    return db.transaction('rw', db.counters, async () => {
      const existing = await db.counters.where('key').equals(key).first();
      let current = existing?.value ?? 0;
      const codes: string[] = [];
      for (let i = 0; i < count; i++) {
        current += 1;
        codes.push(`${DocPrefix.Carton}${padSequence(current, 6)}`);
      }
      if (existing) {
        await db.counters.update(existing.id, { value: current });
      } else {
        await db.counters.add({ id: key, key, value: current });
      }
      return codes;
    });
  }

  async peekCartonSequence(): Promise<number> {
    const existing = await db.counters.where('key').equals(DocPrefix.Carton).first();
    return existing?.value ?? 0;
  }
}
