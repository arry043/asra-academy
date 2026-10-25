import { PERMISSIONS } from '@asra/types';
import {
  adminCertificateQuerySchema,
  adminRevokeCertificateSchema,
  certificateIdParamSchema,
  certificateVerifyParamsSchema,
  paginationQuerySchema,
} from '@asra/validation';
import { Router } from 'express';
import { requirePermission } from '../../middleware/authorize.js';
import { certificateRateLimit } from '../../middleware/rate-limit.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { idParamsSchema } from '../../validators/common.validators.js';
import { certificatesController as c } from './certificates.controller.js';

/**
 * Public routes: `/api/v1/certificates/*`
 */
export const publicCertificatesRouter = Router();

publicCertificatesRouter.get(
  '/verify/:certificateNumber',
  certificateRateLimit('verify'),
  validateRequest({ params: certificateVerifyParamsSchema }),
  c.verifyCertificate,
);

/**
 * Student portal routes: to be mounted on `/api/v1/student`
 * Authentication and role check (STUDENT) are already applied on `/student`.
 */
export const studentCertificatesRouter = Router();

const learn = requirePermission(PERMISSIONS.CONTENT_VIEW_ENROLLED);
const byId = validateRequest({ params: idParamsSchema });
const paged = validateRequest({ query: paginationQuerySchema });

studentCertificatesRouter.get('/certificates', learn, paged, c.getStudentCertificates);
studentCertificatesRouter.get('/certificates/:id', learn, byId, c.getStudentCertificate);
studentCertificatesRouter.get(
  '/certificates/:id/download',
  learn,
  byId,
  c.downloadStudentCertificate,
);
studentCertificatesRouter.get(
  '/courses/:id/certificate/eligibility',
  learn,
  byId,
  c.checkCourseEligibility,
);
studentCertificatesRouter.post('/courses/:id/certificate', learn, byId, c.claimCertificate);

/**
 * Admin portal routes: to be mounted on `/api/v1/admin`
 * Authentication is already applied on `/admin`.
 */
export const certificatesAdminRouter = Router();

certificatesAdminRouter.get(
  '/certificates',
  requirePermission(PERMISSIONS.CERTIFICATES_VIEW),
  validateRequest({ query: adminCertificateQuerySchema }),
  c.listAdminCertificates,
);

certificatesAdminRouter.get(
  '/certificates/:id',
  requirePermission(PERMISSIONS.CERTIFICATES_VIEW),
  validateRequest({ params: certificateIdParamSchema }),
  c.getAdminCertificate,
);

certificatesAdminRouter.get(
  '/certificates/:id/download',
  requirePermission(PERMISSIONS.CERTIFICATES_VIEW),
  validateRequest({ params: certificateIdParamSchema }),
  c.downloadAdminCertificate,
);

certificatesAdminRouter.post(
  '/certificates/:id/revoke',
  requirePermission(PERMISSIONS.CERTIFICATES_MANAGE),
  validateRequest({ params: certificateIdParamSchema, body: adminRevokeCertificateSchema }),
  c.revokeCertificate,
);
