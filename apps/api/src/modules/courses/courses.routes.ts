import { PERMISSIONS } from '@asra/types';
import {
  adminCourseListQuerySchema,
  courseCategoryCreateSchema,
  courseCategoryUpdateSchema,
  courseCreateSchema,
  courseInstructorsSchema,
  courseTransitionSchema,
  courseUpdateSchema,
  facultyOptionsQuerySchema,
  publicCourseListQuerySchema,
} from '@asra/validation';
import { Router } from 'express';
import { requirePermission } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { idParamsSchema, slugParamsSchema } from '../../validators/common.validators.js';
import { registerCatalogueRoutes } from '../shared/catalogue-routes.js';
import { courseCategoryService } from './categories.service.js';
import { courseController, publicCourseController } from './courses.controller.js';

/** `/api/v1/admin/{course-categories,courses,faculty}` — `courses.manage`. */
export const coursesAdminRouter = Router();
const allowed = requirePermission(PERMISSIONS.COURSES_MANAGE);
const byId = validateRequest({ params: idParamsSchema });
const transition = validateRequest({ params: idParamsSchema, body: courseTransitionSchema });

registerCatalogueRoutes(coursesAdminRouter, '/course-categories', {
  service: courseCategoryService,
  label: 'Course category',
  permission: PERMISSIONS.COURSES_MANAGE,
  createSchema: courseCategoryCreateSchema,
  updateSchema: courseCategoryUpdateSchema,
});

coursesAdminRouter.get(
  '/faculty',
  allowed,
  validateRequest({ query: facultyOptionsQuerySchema }),
  courseController.facultyOptions,
);

coursesAdminRouter.get(
  '/courses',
  allowed,
  validateRequest({ query: adminCourseListQuerySchema }),
  courseController.list,
);
coursesAdminRouter.post(
  '/courses',
  allowed,
  validateRequest({ body: courseCreateSchema }),
  courseController.create,
);
coursesAdminRouter.get('/courses/:id', allowed, byId, courseController.get);
coursesAdminRouter.patch(
  '/courses/:id',
  allowed,
  validateRequest({ params: idParamsSchema, body: courseUpdateSchema }),
  courseController.update,
);
coursesAdminRouter.delete('/courses/:id', allowed, byId, courseController.remove);
coursesAdminRouter.put(
  '/courses/:id/instructors',
  allowed,
  validateRequest({ params: idParamsSchema, body: courseInstructorsSchema }),
  courseController.setInstructors,
);
coursesAdminRouter.post('/courses/:id/publish', allowed, transition, courseController.publish);
coursesAdminRouter.post('/courses/:id/unpublish', allowed, transition, courseController.unpublish);
coursesAdminRouter.post('/courses/:id/archive', allowed, transition, courseController.archive);
coursesAdminRouter.post('/courses/:id/restore', allowed, transition, courseController.restore);

/** `/api/v1/courses` — anonymous, published courses only (see public-catalog.service.ts). */
export const publicCoursesRouter = Router();

publicCoursesRouter.get(
  '/',
  validateRequest({ query: publicCourseListQuerySchema }),
  publicCourseController.list,
);
publicCoursesRouter.get(
  '/:slug',
  validateRequest({ params: slugParamsSchema }),
  publicCourseController.get,
);
