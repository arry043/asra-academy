import type { Paginated } from '@asra/types';

export interface PageRequest {
  page: number;
  pageSize: number;
}

/** Prisma `skip`/`take` for a 1-based page (FR-SCL-005: every list endpoint is paginated). */
export function pageArgs({ page, pageSize }: PageRequest): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

/** The `{ items, pagination }` payload shared by every paginated endpoint. */
export function paginated<TItem>(
  items: TItem[],
  total: number,
  { page, pageSize }: PageRequest,
): Paginated<TItem> {
  return {
    items,
    pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
  };
}
