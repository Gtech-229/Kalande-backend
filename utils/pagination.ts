/**
 * Offset-based pagination helpers (pure, no DB, no Express).
 * Used by list services to return a consistent { items, pagination } shape.
 */

/** Pagination metadata returned alongside a page of items. */
export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

/** A page of items plus its pagination metadata. */
export type Paginated<T> = { items: T[]; pagination: PaginationMeta };

/** SQL OFFSET (Prisma `skip`) for a 1-based page. */
export function pageSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}

/** Wrap a page of items + the total count into the standard paginated shape. */
export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): Paginated<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
