import { PERMISSIONS } from '@asra/types';
import {
  paginationQuerySchema,
  studentCatalogQuerySchema,
  studentEnrollmentListQuerySchema,
  studentLessonListQuerySchema,
  studentProfileUpdateSchema,
  videoProgressSchema,
} from '@asra/validation';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission, requireRole } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { idParamsSchema } from '../../validators/common.validators.js';
import { studentController as c } from './student.controller.js';

/**
 * `/api/v1/student/*` — the student portal (PHASE 07, docs/STUDENT-LMS.md §6).
 *
 * Every request: `authenticate` → `requireRole('STUDENT')` → `no-store`. Course content routes
 * also require `content.view_enrolled` and the service checks the per-course enrolment policy;
 * profile routes require `profile.manage_own`. Data is always scoped to `req.auth.userId`.
 */
export const studentRouter = Router();

studentRouter.use(authenticate, requireRole('STUDENT'), (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const learn = requirePermission(PERMISSIONS.CONTENT_VIEW_ENROLLED);
const own = requirePermission(PERMISSIONS.PROFILE_MANAGE_OWN);
const byId = validateRequest({ params: idParamsSchema });
const paged = validateRequest({ query: paginationQuerySchema });

const r = studentRouter;

r.get('/dashboard', learn, c.dashboard);
r.get('/features', c.features);

r.get('/courses', learn, paged, c.courses);
r.get(
  '/enrollments',
  learn,
  validateRequest({ query: studentEnrollmentListQuerySchema }),
  c.enrollments,
);
r.get('/catalog', learn, validateRequest({ query: studentCatalogQuerySchema }), c.catalog);
r.post('/courses/:id/enroll', learn, byId, c.enroll);
r.get('/courses/:id', learn, byId, c.courseOverview);
r.get('/courses/:id/curriculum', learn, byId, c.curriculum);
r.get('/courses/:id/progress', learn, byId, c.courseProgress);

r.get('/lessons', learn, validateRequest({ query: studentLessonListQuerySchema }), c.lessons);
r.get('/lessons/:id', learn, byId, c.lesson);
r.get('/lessons/:id/resources', learn, byId, c.lessonResources);
r.post('/lessons/:id/activity', learn, byId, c.recordActivity);
r.post('/lessons/:id/complete', learn, byId, c.complete);
r.delete('/lessons/:id/complete', learn, byId, c.reopen);
r.put(
  '/lessons/:id/progress',
  learn,
  validateRequest({ params: idParamsSchema, body: videoProgressSchema }),
  c.videoProgress,
);

r.get('/history', learn, paged, c.history);

r.get('/profile', own, c.profile);
r.patch('/profile', own, validateRequest({ body: studentProfileUpdateSchema }), c.updateProfile);
