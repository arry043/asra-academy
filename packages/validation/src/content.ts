import { z } from 'zod';
import { safeExternalUrlSchema } from './common.js';

/**
 * Location of a learning resource. Mirrors the database CHECKs `resources_location_exclusive`
 * and `resources_external_link_has_url`: a resource is EITHER a stored object (provider + key)
 * OR an external URL — never both, never neither. Binary data is never sent to PostgreSQL.
 *
 * Stored objects are accepted by this schema, but the API rejects them while no storage provider
 * is configured (CLIENT-CLARIFICATIONS R-01, G-01) — see apps/api/src/modules/curriculum.
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

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const resourceTypeSchema = z.enum(RESOURCE_TYPES);

const storedLocationSchema = z
  .object({
    kind: z.literal('storage'),
    storageProvider: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9_-]+$/, 'Use a lower-case provider identifier'),
    storageKey: z.string().trim().min(1).max(1024),
  })
  .strict();

/** External resources: HTTPS on a public domain, no credentials (PHASE 06 tightened http → https). */
const externalLocationSchema = z
  .object({ kind: z.literal('external'), externalUrl: safeExternalUrlSchema })
  .strict();

export const resourceLocationSchema = z.discriminatedUnion('kind', [
  storedLocationSchema,
  externalLocationSchema,
]);

export type ResourceLocation = z.infer<typeof resourceLocationSchema>;

const resourceFields = {
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters'),
  type: resourceTypeSchema,
  location: resourceLocationSchema,
  mimeType: z
    .string()
    .trim()
    .max(255)
    .regex(/^[\w.+-]+\/[\w.+-]+$/, 'Use a MIME type such as application/pdf')
    .nullable()
    .optional(),
  sizeBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
};

/** Mirrors `resources_external_link_has_url`, checked against the final state. */
export function resourceLocationIssue(
  type: ResourceType,
  location: ResourceLocation,
): string | null {
  return type === 'EXTERNAL_LINK' && location.kind !== 'external'
    ? 'External link resources must use an external URL'
    : null;
}

export const resourceInputSchema = z
  .object(resourceFields)
  .strict()
  .superRefine((value, context) => {
    const issue = resourceLocationIssue(value.type, value.location);
    if (issue) context.addIssue({ code: 'custom', path: ['location'], message: issue });
  });

export const resourceUpdateSchema = z.object(resourceFields).partial().strict();

export type ResourceInput = z.infer<typeof resourceInputSchema>;
export type ResourceUpdateInput = z.infer<typeof resourceUpdateSchema>;
