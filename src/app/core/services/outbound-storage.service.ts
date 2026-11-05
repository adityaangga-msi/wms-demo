import { Injectable } from '@angular/core';
import { db } from '../db/wms-database';
import { OutboundStatus } from '../enums';
import { OutboundHeader } from '../models';

@Injectable({ providedIn: 'root' })
export class OutboundStorageService {
  getAll(): Promise<OutboundHeader[]> {
    return db.outbounds.orderBy('createdAt').reverse().toArray();
  }

  getById(id: string): Promise<OutboundHeader | undefined> {
    return db.outbounds.get(id);
  }

  getByDocNo(docNo: string): Promise<OutboundHeader | undefined> {
    return db.outbounds.where('docNo').equals(docNo).first();
  }

  getByStatus(status: OutboundStatus): Promise<OutboundHeader[]> {
    return db.outbounds.where('status').equals(status).reverse().sortBy('createdAt');
  }

  async put(doc: OutboundHeader): Promise<void> {
    await db.outbounds.put(doc);
  }

  async remove(id: string): Promise<void> {
    await db.outbounds.delete(id);
  }

  async clear(): Promise<void> {
    await db.outbounds.clear();
  }
}
