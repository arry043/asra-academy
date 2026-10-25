import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.js';

export const certificateVerifyParamsSchema = z.object({
  certificateNumber: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[A-Za-z0-9-]+$/, 'Certificate number can only contain letters, digits, and hyphens'),
});

export type CertificateVerifyParams = z.infer<typeof certificateVerifyParamsSchema>;

export const certificateCourseParamsSchema = z.object({
  courseId: uuidSchema,
});

export type CertificateCourseParams = z.infer<typeof certificateCourseParamsSchema>;

export const certificateIdParamSchema = z.object({
  id: uuidSchema,
});

export type CertificateIdParam = z.infer<typeof certificateIdParamSchema>;

export const adminCertificateQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['ISSUED', 'REVOKED']).optional(),
  courseId: uuidSchema.optional(),
  studentId: uuidSchema.optional(),
});

export type AdminCertificateQuery = z.infer<typeof adminCertificateQuerySchema>;

export const adminRevokeCertificateSchema = z.object({
  reason: z.string().trim().min(3, 'Revocation reason must be at least 3 characters').max(500),
});

export type AdminRevokeCertificateInput = z.infer<typeof adminRevokeCertificateSchema>;
