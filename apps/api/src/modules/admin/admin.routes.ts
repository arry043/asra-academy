import { PERMISSIONS } from '@asra/types';
import {
  adminAssessmentListQuerySchema,
  adminAuditLogQuerySchema,
  adminGlobalEnrollmentQuerySchema,
  adminNotificationDeliveryQuerySchema,
  adminUserListQuerySchema,
  adminUserRoleGrantSchema,
  adminUserStatusSchema,
  analyticsPageQuerySchema,
  analyticsRangeQuerySchema,
  revenueAnalyticsQuerySchema,
  roleKeySchema,
  type AdminAssessmentListQuery,
  type AdminAuditLogQuery,
  type AdminGlobalEnrollmentQuery,
  type AdminNotificationDeliveryQuery,
  type AdminUserListQuery,
  type AdminUserRoleGrantInput,
  type AdminUserStatusInput,
  type AnalyticsPageQuery,
  type AnalyticsRangeQuery,
  type RevenueAnalyticsQuery,
} from '@asra/validation';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAnyPermission, requirePermission } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { sendSuccess } from '../../utils/api-response.js';
import { idParamsSchema } from '../../validators/common.validators.js';
import { analyticsService as analytics } from './analytics.service.js';
import { auditLogService } from './audit.js';
import { dashboardService } from './dashboard.service.js';
import { operationsService as ops } from './operations.service.js';
import { usersService as users } from './users.service.js';

/**
 * PHASE 12 administration routes (docs/ADMIN-DASHBOARD.md §8), mounted inside `/admin`
 * (authenticated, `Cache-Control: no-store`). Every route requires a permission here; the services
 * re-check resource-level rules (which accounts, which sections).
 */
export const adminPortalRouter = Router();
const r = adminPortalRouter;

const id = (req: Request) => String(req.params.id);
const analyticsView = requirePermission(PERMISSIONS.ANALYTICS_VIEW);

// --- Dashboard & analytics --------------------------------------------------------------------

r.get('/dashboard', analyticsView, async (req: Request, res: Response) => {
  sendSuccess(res, await dashboardService.get(req.auth!));
});

const range = validateRequest({ query: analyticsRangeQuerySchema });
const page = validateRequest({ query: analyticsPageQuerySchema });

r.get('/analytics/student-growth', analyticsView, range, async (req: Request, res: Response) => {
  sendSuccess(res, await analytics.studentGrowth(req.query as unknown as AnalyticsRangeQuery));
});

r.get('/analytics/enrollments', analyticsView, range, async (req: Request, res: Response) => {
  sendSuccess(res, await analytics.enrollments(req.query as unknown as AnalyticsRangeQuery));
});

r.get('/analytics/popular-courses', analyticsView, page, async (req: Request, res: Response) => {
  sendSuccess(res, await analytics.popularCourses(req.query as unknown as AnalyticsPageQuery));
});

r.get(
  '/analytics/revenue',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.PAYMENTS_VIEW),
  validateRequest({ query: revenueAnalyticsQuerySchema }),
  async (req: Request, res: Response) => {
    sendSuccess(res, await analytics.revenue(req.query as unknown as RevenueAnalyticsQuery));
  },
);

r.get('/analytics/completion', analyticsView, page, async (req: Request, res: Response) => {
  sendSuccess(res, await analytics.completion(req.query as unknown as AnalyticsPageQuery));
});

r.get('/analytics/exams', analyticsView, page, async (req: Request, res: Response) => {
  sendSuccess(res, await analytics.exams(req.query as unknown as AnalyticsPageQuery));
});

r.get('/analytics/faculty', analyticsView, page, async (req: Request, res: Response) => {
  sendSuccess(res, await analytics.faculty(req.query as unknown as AnalyticsPageQuery));
});

// --- Users & roles ----------------------------------------------------------------------------
// The exact permission depends on the account (students/faculty/admins.manage): the route needs
// one of them, and the service checks the one that matches the target account.

const anyDirectory = requireAnyPermission(
  PERMISSIONS.STUDENTS_MANAGE,
  PERMISSIONS.FACULTY_MANAGE,
  PERMISSIONS.ADMINS_MANAGE,
);

r.get(
  '/users',
  anyDirectory,
  validateRequest({ query: adminUserListQuerySchema }),
  async (req: Request, res: Response) => {
    sendSuccess(res, await users.list(req.auth!, req.query as unknown as AdminUserListQuery));
  },
);

r.get(
  '/users/:id',
  anyDirectory,
  validateRequest({ params: idParamsSchema }),
  async (req: Request, res: Response) => {
    sendSuccess(res, await users.detail(req.auth!, id(req)));
  },
);

r.patch(
  '/users/:id/status',
  anyDirectory,
  validateRequest({ params: idParamsSchema, body: adminUserStatusSchema }),
  async (req: Request, res: Response) => {
    const data = await users.setStatus(req.auth!, id(req), req.body as AdminUserStatusInput);
    sendSuccess(res, data, 'Account status updated');
  },
);

const rolesManage = requirePermission(PERMISSIONS.ROLES_MANAGE);

r.post(
  '/users/:id/roles',
  rolesManage,
  validateRequest({ params: idParamsSchema, body: adminUserRoleGrantSchema }),
  async (req: Request, res: Response) => {
    const { role } = req.body as AdminUserRoleGrantInput;
    sendSuccess(res, await users.grantRole(req.auth!, id(req), role), 'Role granted', 201);
  },
);

r.delete(
  '/users/:id/roles/:role',
  rolesManage,
  validateRequest({ params: idParamsSchema.extend({ role: roleKeySchema }) }),
  async (req: Request, res: Response) => {
    const data = await users.revokeRole(req.auth!, id(req), String(req.params.role));
    sendSuccess(res, data, 'Role revoked');
  },
);

r.get('/roles', rolesManage, async (_req: Request, res: Response) => {
  sendSuccess(res, await users.roles());
});

// --- Audit logs -------------------------------------------------------------------------------

r.get(
  '/audit-logs',
  requirePermission(PERMISSIONS.AUDIT_LOGS_VIEW),
  validateRequest({ query: adminAuditLogQuerySchema }),
  async (req: Request, res: Response) => {
    sendSuccess(res, await auditLogService.list(req.query as unknown as AdminAuditLogQuery));
  },
);

// --- Operational lists ------------------------------------------------------------------------

r.get(
  '/enrollments',
  requirePermission(PERMISSIONS.ENROLLMENTS_MANAGE),
  validateRequest({ query: adminGlobalEnrollmentQuerySchema }),
  async (req: Request, res: Response) => {
    sendSuccess(res, await ops.enrollments(req.query as unknown as AdminGlobalEnrollmentQuery));
  },
);

const notificationsView = requirePermission(PERMISSIONS.NOTIFICATIONS_VIEW);

r.get(
  '/notifications/deliveries/summary',
  notificationsView,
  async (_req: Request, res: Response) => {
    sendSuccess(res, await ops.deliverySummary());
  },
);

r.get(
  '/notifications/deliveries',
  notificationsView,
  validateRequest({ query: adminNotificationDeliveryQuerySchema }),
  async (req: Request, res: Response) => {
    sendSuccess(res, await ops.deliveries(req.query as unknown as AdminNotificationDeliveryQuery));
  },
);

const assessmentKinds = { assignments: ops.assignments, quizzes: ops.quizzes, exams: ops.exams };

r.get(
  '/assessments/:kind',
  requirePermission(PERMISSIONS.CONTENT_MANAGE),
  validateRequest({
    params: z.object({ kind: z.enum(['assignments', 'quizzes', 'exams']) }),
    query: adminAssessmentListQuerySchema,
  }),
  async (req: Request, res: Response) => {
    const kind = String(req.params.kind) as keyof typeof assessmentKinds;
    const query = req.query as unknown as AdminAssessmentListQuery;
    sendSuccess(res, await assessmentKinds[kind](query));
  },
);
