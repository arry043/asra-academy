import { z } from 'zod';

/**
 * Location of a learning resource. Mirrors the database CHECKs `resources_location_exclusive`
 * and `resources_external_link_has_url`: a resource is EITHER a stored object (provider + key)
 * OR an external URL — never both, never neither. Binary data is never sent to PostgreSQL.
 */
export const RESOURCE_TYPES = [
  'VIDEO',
  'PDF',
  'DOCUMENT',
  'PRESENTATION',
  'IMAGE',
  'AUDIO',
  'EXTERNAL_LINK',
  'OTHER',
] as const;

export const resourceTypeSchema = z.enum(RESOURCE_TYPES);

const storedLocationSchema = z.object({
  kind: z.literal('storage'),
  storageProvider: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, 'Use a lower-case provider identifier'),
  storageKey: z.string().trim().min(1).max(1024),
});

const externalLocationSchema = z.object({
  kind: z.literal('external'),
  externalUrl: z.url({ protocol: /^https?$/ }).max(2048),
});

export const resourceLocationSchema = z.discriminatedUnion('kind', [
  storedLocationSchema,
  externalLocationSchema,
]);

export type ResourceLocation = z.infer<typeof resourceLocationSchema>;

export const resourceInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    type: resourceTypeSchema,
    location: resourceLocationSchema,
    mimeType: z.string().trim().max(255).optional(),
    sizeBytes: z.number().int().min(0).optional(),
  })
  .refine((value) => value.type !== 'EXTERNAL_LINK' || value.location.kind === 'external', {
    message: 'EXTERNAL_LINK resources must use an external URL',
    path: ['location'],
  });

export type ResourceInput = z.infer<typeof resourceInputSchema>;
