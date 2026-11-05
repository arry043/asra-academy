import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.js';

/**
 * Validates and normalizes an Indian 10-digit mobile number.
 * Accepts formats:
 * - 9876543210
 * - +91 9876543210
 * - +91-98765-43210
 * - 09876543210
 * Normalizes to pure 10-digit format starting with 6, 7, 8, or 9.
 */
export const indianPhoneSchema = z
  .string()
  .trim()
  .min(10, 'Mobile number must be at least 10 digits')
  .max(20, 'Mobile number is too long')
  .transform((raw, ctx) => {
    // Strip common separators: spaces, dashes, dots, parentheses
    let cleaned = raw.replace(/[\s\-().]/g, '');

    // Strip leading '+' or '00'
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.slice(1);
    } else if (cleaned.startsWith('00')) {
      cleaned = cleaned.slice(2);
    }

    // Strip country code '91' if 12 digits
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      cleaned = cleaned.slice(2);
    }
    // Strip leading trunk prefix '0' if 11 digits
    else if (cleaned.length === 11 && cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }

    // Must now be exactly 10 digits and start with 6, 7, 8, or 9
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9)',
      });
      return z.NEVER;
    }

    return cleaned;
  });

export const jobStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

export const jobApplicationStatusSchema = z.enum([
  'RECEIVED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'ON_HOLD',
  'INTERVIEW_SCHEDULED',
  'ACCEPTED',
  'REJECTED',
]);

export const jobQuestionTypeSchema = z.enum([
  'SHORT_TEXT',
  'LONG_TEXT',
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'YES_NO',
  'NUMBER',
  'DATE',
  'URL',
]);

export const jobQuestionValidationSchema = z
  .object({
    minLength: z.number().int().min(0).max(5000).optional(),
    maxLength: z.number().int().min(1).max(5000).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .strict()
  .optional();

export const jobQuestionInputSchema = z
  .object({
    id: uuidSchema.optional(),
    label: z.string().trim().min(2, 'Question label must be at least 2 characters').max(200),
    helpText: z.string().trim().max(500).optional().nullable(),
    fieldType: jobQuestionTypeSchema,
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(150)).max(50).optional().nullable(),
    displayOrder: z.number().int().min(0).default(0),
    validation: jobQuestionValidationSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.fieldType === 'SINGLE_SELECT' || data.fieldType === 'MULTI_SELECT') &&
      (!data.options || data.options.length < 2)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Select questions must have at least 2 options',
      });
    }
  });

export type JobQuestionInput = z.infer<typeof jobQuestionInputSchema>;

export const adminJobBaseSchema = z.object({
  title: z.string().trim().min(3, 'Job title must be at least 3 characters').max(150),
  department: z.string().trim().min(2, 'Department is required').max(100),
  category: z.string().trim().min(2, 'Category is required').max(100),
  employmentType: z
    .enum([
      'Full-time',
      'Part-time',
      'Contract',
      'Internship',
      'Visiting Faculty',
      'FULL_TIME',
      'PART_TIME',
      'CONTRACT',
      'INTERNSHIP',
      'VISITING_FACULTY',
    ])
    .default('Full-time'),
  workLocation: z.string().trim().min(2, 'Work location is required').max(100),
  workArrangement: z
    .enum(['On-site', 'Hybrid', 'Remote', 'ON_SITE', 'HYBRID', 'REMOTE'])
    .default('On-site'),
  vacancies: z.number().int().min(1).max(999).optional().nullable(),
  experienceRequired: z.string().trim().max(100).optional().nullable(),
  minQualification: z.string().trim().max(150).optional().nullable(),
  maxQualification: z.string().trim().max(150).optional().nullable(),
  salaryMin: z.number().int().min(0).optional().nullable(),
  salaryMax: z.number().int().min(0).optional().nullable(),
  currency: z.string().trim().length(3).default('INR'),
  isSalaryPublic: z.boolean().default(false),
  shortDescription: z.string().trim().max(500).optional().nullable(),
  description: z
    .string()
    .trim()
    .min(20, 'Job description must be at least 20 characters')
    .max(20000),
  responsibilities: z.string().trim().max(10000).optional().nullable(),
  requiredSkills: z.string().trim().max(10000).optional().nullable(),
  preferredSkills: z.string().trim().max(10000).optional().nullable(),
  requiredQualifications: z.string().trim().max(10000).optional().nullable(),
  additionalRequirements: z.string().trim().max(10000).optional().nullable(),
  benefits: z.string().trim().max(10000).optional().nullable(),
  status: jobStatusSchema.default('DRAFT'),
  openingDate: z.string().datetime({ offset: true }).optional().nullable(),
  closingDate: z.string().datetime({ offset: true }).optional().nullable(),
  allowApplications: z.boolean().default(true),
  questions: z.array(jobQuestionInputSchema).max(30).default([]),
});

function refineJobDatesAndSalary(
  data: {
    salaryMin?: number | null;
    salaryMax?: number | null;
    openingDate?: string | null;
    closingDate?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (
    typeof data.salaryMin === 'number' &&
    typeof data.salaryMax === 'number' &&
    data.salaryMax < data.salaryMin
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['salaryMax'],
      message: 'Maximum salary cannot be less than minimum salary',
    });
  }
  if (data.openingDate && data.closingDate) {
    const open = new Date(data.openingDate).getTime();
    const close = new Date(data.closingDate).getTime();
    if (close <= open) {
      ctx.addIssue({
        code: 'custom',
        path: ['closingDate'],
        message: 'Application closing date must be after opening date',
      });
    }
  }
}

export const adminCreateJobSchema = adminJobBaseSchema.superRefine(refineJobDatesAndSalary);

export type AdminCreateJobInput = z.infer<typeof adminCreateJobSchema>;

export const adminUpdateJobSchema = adminJobBaseSchema
  .partial()
  .extend({
    questions: z.array(jobQuestionInputSchema).max(30).optional(),
  })
  .superRefine(refineJobDatesAndSalary);

export type AdminUpdateJobInput = z.infer<typeof adminUpdateJobSchema>;

export const adminJobQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  status: jobStatusSchema.optional(),
  department: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
});

export type AdminJobQuery = z.infer<typeof adminJobQuerySchema>;

export const publicJobQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  employmentType: z.string().trim().max(100).optional(),
  workArrangement: z.string().trim().max(100).optional(),
  location: z.string().trim().max(100).optional(),
});

export type PublicJobQuery = z.infer<typeof publicJobQuerySchema>;

export const publicSubmitApplicationSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters')
      .max(150, 'Full name is too long')
      .regex(/^[\p{L}\s.'-]+$/u, 'Name contains invalid characters'),
    email: z
      .string()
      .trim()
      .email('Please enter a valid email address')
      .max(320)
      .transform((e) => e.toLowerCase()),
    phone: indianPhoneSchema,
    currentLocation: z.string().trim().max(100).optional(),
    currentCity: z.string().trim().max(100).optional(),
    resumeAssetId: z.string().trim().min(5, 'Resume asset is required').max(255),
    resumeOriginalName: z.string().trim().max(255).optional(),
    resumeFileName: z.string().trim().max(255).optional(),
    resumeMimeType: z.string().default('application/pdf'),
    resumeFileSize: z
      .number()
      .int()
      .min(1)
      .max(5 * 1024 * 1024, 'Resume file size cannot exceed 5MB'),
    consentGiven: z.literal(true, {
      error: 'You must agree to the privacy policy and data processing',
    }),
    answers: z
      .array(
        z.object({
          questionId: uuidSchema,
          value: z.union([
            z.string().max(5000),
            z.array(z.string().max(200)).max(50),
            z.number(),
            z.boolean(),
          ]),
        }),
      )
      .default([]),
  })
  .transform((data, ctx) => {
    const loc = data.currentLocation || data.currentCity;
    if (!loc || loc.trim().length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['currentLocation'],
        message: 'Current location is required (minimum 2 characters)',
      });
      return z.NEVER;
    }
    const originalName = data.resumeOriginalName || data.resumeFileName || 'resume.pdf';
    return {
      ...data,
      currentLocation: loc.trim(),
      resumeOriginalName: originalName,
    };
  });

export type PublicSubmitApplicationInput = z.infer<typeof publicSubmitApplicationSchema>;

export const adminApplicationQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  jobId: uuidSchema.optional(),
  status: jobApplicationStatusSchema.optional(),
  department: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
});

export type AdminApplicationQuery = z.infer<typeof adminApplicationQuerySchema>;

export const adminChangeApplicationStatusSchema = z.object({
  status: jobApplicationStatusSchema,
  reason: z.string().trim().max(500).optional().nullable(),
  sendEmail: z.boolean().default(true),
  customMessage: z.string().trim().max(2000).optional().nullable(),
  followUpDate: z.string().datetime({ offset: true }).optional().nullable(),
});

export type AdminChangeApplicationStatusInput = z.infer<typeof adminChangeApplicationStatusSchema>;

export const adminScheduleInterviewSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
  durationMinutes: z.coerce.number().int().min(15).max(240).default(45),
  timezone: z.string().trim().min(2).max(50).default('Asia/Kolkata'),
  interviewType: z.string().trim().min(2).max(50).default('Technical Interview'),
  meetingUrl: z.url({ protocol: /^https?$/ }).max(2048),
  instructions: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  sendEmail: z.boolean().default(true),
  customMessage: z.string().trim().max(2000).optional().nullable(),
});

export type AdminScheduleInterviewInput = z.infer<typeof adminScheduleInterviewSchema>;

export const adminRescheduleInterviewSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
  durationMinutes: z.coerce.number().int().min(15).max(240).optional(),
  meetingUrl: z
    .url({ protocol: /^https?$/ })
    .max(2048)
    .optional(),
  instructions: z.string().trim().max(2000).optional().nullable(),
  sendEmail: z.boolean().default(true),
  customMessage: z.string().trim().max(2000).optional().nullable(),
});

export type AdminRescheduleInterviewInput = z.infer<typeof adminRescheduleInterviewSchema>;

export const adminCancelInterviewSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason is required').max(500),
  sendEmail: z.boolean().default(true),
  customMessage: z.string().trim().max(2000).optional().nullable(),
});

export type AdminCancelInterviewInput = z.infer<typeof adminCancelInterviewSchema>;

export const adminAddNoteSchema = z.object({
  note: z.string().trim().min(1, 'Note cannot be empty').max(2000),
});

export type AdminAddNoteInput = z.infer<typeof adminAddNoteSchema>;

export const adminSendEmailSchema = z.object({
  template: z.enum([
    'application_received',
    'application_under_review',
    'application_shortlisted',
    'application_on_hold',
    'interview_scheduled',
    'interview_rescheduled',
    'interview_cancelled',
    'application_accepted',
    'application_rejected',
    'custom',
    'CUSTOM',
    'CUSTOM_RECRUITMENT',
  ]),
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(200),
  adminMessage: z.string().trim().min(1, 'Message cannot be empty').max(3000),
});

export type AdminSendEmailInput = z.infer<typeof adminSendEmailSchema>;
