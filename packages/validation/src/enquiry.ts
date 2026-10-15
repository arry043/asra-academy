import { z } from 'zod';
import { fullNameSchema } from './auth.js';
import { emailSchema } from './common.js';

/**
 * Public enquiry (Contact Us / admission enquiry — REQ-COM-003). Shared by the web form today and
 * by the future `POST /api/v1/enquiries` endpoint, which must re-validate with this same schema:
 * browser validation is a convenience, never a security boundary.
 *
 * Topic keys match the public programme slugs (apps/web/src/content/programmes.ts) plus
 * `admission` and `general`. Labels live in the web app.
 */
export const ENQUIRY_TOPICS = [
  'admission',
  'classes-6-10',
  'classes-11-12',
  'english',
  'entrepreneurship',
  'quranic-studies',
  'arabic',
  'urdu',
  'general',
] as const;

export type EnquiryTopic = (typeof ENQUIRY_TOPICS)[number];

export const ENQUIRY_MESSAGE_MAX_LENGTH = 1500;

/** Optional phone: digits with common separators and an optional leading +; 7–15 digits. */
const phoneSchema = z
  .string()
  .trim()
  .max(25, 'Phone number is too long')
  .regex(/^\+?[\d\s()-]*$/, 'Use digits, spaces, brackets, hyphens and an optional leading +')
  .refine((value) => {
    const digits = value.replace(/\D/g, '').length;
    return digits >= 7 && digits <= 15;
  }, 'Enter a valid phone number');

export const enquirySchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    /** Empty input means "not given". */
    phone: z
      .union([z.literal(''), phoneSchema])
      .optional()
      .transform((value) => (value ? value : undefined)),
    topic: z.enum(ENQUIRY_TOPICS, { message: 'Choose what your enquiry is about' }),
    message: z
      .string()
      .trim()
      .min(10, 'Message must be at least 10 characters')
      .max(
        ENQUIRY_MESSAGE_MAX_LENGTH,
        `Message must be at most ${ENQUIRY_MESSAGE_MAX_LENGTH} characters`,
      ),
  })
  .strict();

export type EnquiryInput = z.infer<typeof enquirySchema>;
