export type PaginationItem = { type: 'page'; page: number } | { type: 'ellipsis'; key: string };

/**
 * The page numbers to show for a paginator, with ellipses for gaps. Always includes the first and
 * last page and `siblings` pages either side of the current one. The item count stays constant
 * while paging (no layout jump). Out-of-range input is clamped.
 *
 *   getPaginationRange(6, 12) → 1 … 5 6 7 … 12
 */
export function getPaginationRange(
  page: number,
  pageCount: number,
  siblings = 1,
): PaginationItem[] {
  const total = Math.max(1, Math.floor(pageCount) || 1);
  const current = Math.min(Math.max(1, Math.floor(page) || 1), total);
  const span = siblings * 2 + 5; // first + last + current + siblings + two ellipses

  const pages = (from: number, to: number): PaginationItem[] =>
    Array.from({ length: to - from + 1 }, (_, index) => ({ type: 'page', page: from + index }));

  if (total <= span) return pages(1, total);

  const left = Math.max(current - siblings, 1);
  const right = Math.min(current + siblings, total);
  const showLeftGap = left > 3;
  const showRightGap = right < total - 2;

  if (!showLeftGap) {
    return [
      ...pages(1, 3 + siblings * 2),
      { type: 'ellipsis', key: 'end' },
      ...pages(total, total),
    ];
  }
  if (!showRightGap) {
    return [
      ...pages(1, 1),
      { type: 'ellipsis', key: 'start' },
      ...pages(total - (2 + siblings * 2), total),
    ];
  }
  return [
    ...pages(1, 1),
    { type: 'ellipsis', key: 'start' },
    ...pages(left, right),
    { type: 'ellipsis', key: 'end' },
    ...pages(total, total),
  ];
}
