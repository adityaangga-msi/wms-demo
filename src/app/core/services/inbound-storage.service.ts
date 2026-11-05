import { Injectable } from '@angular/core';
import { db } from '../db/wms-database';
import { InboundStatus } from '../enums';
import { InboundHeader } from '../models';

@Injectable({ providedIn: 'root' })
export class InboundStorageService {
  getAll(): Promise<InboundHeader[]> {
    return db.inbounds.orderBy('createdAt').reverse().toArray();
  }

  getById(id: string): Promise<InboundHeader | undefined> {
    return db.inbounds.get(id);
  }

  getByDocNo(docNo: string): Promise<InboundHeader | undefined> {
    return db.inbounds.where('docNo').equals(docNo).first();
  }

  getByStatus(status: InboundStatus): Promise<InboundHeader[]> {
    return db.inbounds.where('status').equals(status).reverse().sortBy('createdAt');
  }

  async put(doc: InboundHeader): Promise<void> {
    await db.inbounds.put(doc);
  }

  async remove(id: string): Promise<void> {
    await db.inbounds.delete(id);
  }

  async clear(): Promise<void> {
    await db.inbounds.clear();
  }
}
