import { paginationQuerySchema, slugSchema, uuidSchema } from '@asra/validation';
import { z } from 'zod';

/** `/:id` route parameter — every primary key is a UUID. */
export const idParamsSchema = z.object({ id: uuidSchema });

/** `/:slug` route parameter for public, SEO-friendly lookups (courses, categories, …). */
export const slugParamsSchema = z.object({ slug: slugSchema });

/** `?page=&pageSize=` — FR-SCL-005 requires pagination on every list endpoint. */
export const listQuerySchema = paginationQuerySchema;

export type IdParams = z.infer<typeof idParamsSchema>;
export type SlugParams = z.infer<typeof slugParamsSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
