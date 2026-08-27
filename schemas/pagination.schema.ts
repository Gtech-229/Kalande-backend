import { z } from "zod";

/**
 * Shared pagination query params. Merge into a list endpoint's query schema:
 *   export const listXQuerySchema = z.object({ ...filters }).merge(paginationQuerySchema);
 *
 * `page` is 1-based; `limit` is capped to protect the DB. Express gives strings,
 * so both are coerced (CLAUDE.md).
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
