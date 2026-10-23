import { PERMISSIONS } from '@asra/types';
import {
  adminEnrollmentCreateSchema,
  adminEnrollmentListQuerySchema,
  type AdminEnrollmentCreateInput,
  type AdminEnrollmentListQuery,
} from '@asra/validation';
import { Router, type Request, type Response } from 'express';
import { requirePermission } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { sendSuccess } from '../../utils/api-response.js';
import { idParamsSchema } from '../../validators/common.validators.js';
import { enrollmentsService } from './enrollments.service.js';

/**
 * `/api/v1/admin/...` enrolment routes (mounted behind `authenticate` in routes/index.ts).
 * `:id` is the course for collection routes and the enrolment for item routes.
 */
export const enrollmentsAdminRouter = Router();

const allowed = requirePermission(PERMISSIONS.ENROLLMENTS_MANAGE);
const id = (req: Request) => String(req.params.id);

enrollmentsAdminRouter.get(
  '/courses/:id/enrollments',
  allowed,
  validateRequest({ params: idParamsSchema, query: adminEnrollmentListQuerySchema }),
  async (req: Request, res: Response) => {
    const query = req.query as unknown as AdminEnrollmentListQuery;
    sendSuccess(res, await enrollmentsService.list(id(req), query));
  },
);

enrollmentsAdminRouter.post(
  '/courses/:id/enrollments',
  allowed,
  validateRequest({ params: idParamsSchema, body: adminEnrollmentCreateSchema }),
  async (req: Request, res: Response) => {
    const data = await enrollmentsService.enroll(
      req.auth!,
      id(req),
      req.body as AdminEnrollmentCreateInput,
    );
    sendSuccess(res, data, 'Student enrolled', 201);
  },
);

enrollmentsAdminRouter.post(
  '/enrollments/:id/cancel',
  allowed,
  validateRequest({ params: idParamsSchema }),
  async (req: Request, res: Response) => {
    sendSuccess(
      res,
      await enrollmentsService.cancel(id(req), req.auth!.userId),
      'Enrolment cancelled',
    );
  },
);
