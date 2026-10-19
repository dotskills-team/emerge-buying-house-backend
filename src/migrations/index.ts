import { accessControl } from './001-access-control.js';
import { products } from './002-products.js';

export interface Migration {
  /** Sortable and unique, e.g. "001-access-control". Never rename one that has been applied. */
  id: string;
  description: string;
  /** Must be safe to run again if it was interrupted part-way. */
  up(): Promise<void>;
  down(): Promise<void>;
}

/** Applied in this order. Append new migrations; never reorder or edit applied ones. */
export const migrations: Migration[] = [accessControl, products];
