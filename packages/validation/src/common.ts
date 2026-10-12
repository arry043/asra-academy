import { z } from 'zod';

/** Shared primitives reused by API request validators and web forms. */

export const uuidSchema = z.uuid();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const appEnvironmentSchema = z.enum(['development', 'test', 'production']);
