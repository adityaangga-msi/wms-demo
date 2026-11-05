import { Item } from '../models';

/** Fallback bila master item lama belum punya qty per karton. */
export function itemQtyPerCarton(item?: Pick<Item, 'qtyPerCarton'> | null): number {
  const n = Number(item?.qtyPerCarton);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function itemContentUom(item?: Pick<Item, 'contentUom'> | null): string {
  return (item?.contentUom || 'Pcs').trim() || 'Pcs';
}

/** 10 karton × 12 Pcs → "120 Pcs" */
export function formatCartonContent(
  cartonQty: number,
  qtyPerCarton: number,
  contentUom: string,
): string {
  const per = qtyPerCarton > 0 ? qtyPerCarton : 1;
  const total = cartonQty * per;
  const uom = contentUom || 'Pcs';
  const pretty =
    Number.isInteger(total) ? String(total) : total.toLocaleString('id-ID', { maximumFractionDigits: 3 });
  return `${pretty} ${uom}`;
}

export function contentFromCartons(
  cartonQty: number,
  item?: Pick<Item, 'qtyPerCarton' | 'contentUom'> | null,
): { qty: number; uom: string; label: string } {
  const per = itemQtyPerCarton(item);
  const uom = itemContentUom(item);
  const qty = cartonQty * per;
  return { qty, uom, label: formatCartonContent(cartonQty, per, uom) };
}
