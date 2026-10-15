import { z } from 'zod';

/**
 * Public (browser-exposed) configuration. Only `NEXT_PUBLIC_*` variables belong here;
 * they are inlined at build time, so each must be referenced explicitly.
 */
const publicEnvSchema = z.object({
  /** Canonical origin of the website (metadataBase, canonical URLs, sitemap, robots). */
  NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.url().default('http://localhost:4000/api/v1'),
  /**
   * Official WhatsApp enquiry number in international format, digits only (e.g. 91XXXXXXXXXX).
   * Pending from the client (CLIENT-CLARIFICATIONS P-02): while unset, no WhatsApp CTA renders.
   * Spaces, hyphens, brackets and a leading + are stripped before validation.
   */
  NEXT_PUBLIC_WHATSAPP_NUMBER: z
    .string()
    .regex(/^[1-9]\d{7,14}$/, 'NEXT_PUBLIC_WHATSAPP_NUMBER must be 8–15 digits with country code')
    .optional(),
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || undefined,
  NEXT_PUBLIC_WHATSAPP_NUMBER:
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[\s()+-]/g, '') || undefined,
});
