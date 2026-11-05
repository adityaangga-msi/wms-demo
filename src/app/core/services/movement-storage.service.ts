import { Injectable } from '@angular/core';
import { db } from '../db/wms-database';
import { MovementStatus } from '../enums';
import { MovementHeader } from '../models';

@Injectable({ providedIn: 'root' })
export class MovementStorageService {
  getAll(): Promise<MovementHeader[]> {
    return db.movements.orderBy('createdAt').reverse().toArray();
  }

  getById(id: string): Promise<MovementHeader | undefined> {
    return db.movements.get(id);
  }

  getByDocNo(docNo: string): Promise<MovementHeader | undefined> {
    return db.movements.where('docNo').equals(docNo).first();
  }

  getByStatus(status: MovementStatus): Promise<MovementHeader[]> {
    return db.movements.where('status').equals(status).reverse().sortBy('createdAt');
  }

  async put(doc: MovementHeader): Promise<void> {
    await db.movements.put(doc);
  }

  async remove(id: string): Promise<void> {
    await db.movements.delete(id);
  }

  async clear(): Promise<void> {
    await db.movements.clear();
  }
}
