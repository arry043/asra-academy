import { PERMISSIONS } from '@asra/types';
import {
  chapterCreateSchema,
  chapterUpdateSchema,
  lessonCreateSchema,
  lessonUpdateSchema,
  moduleCreateSchema,
  moduleUpdateSchema,
  reorderSchema,
  resourceInputSchema,
  resourceUpdateSchema,
} from '@asra/validation';
import { Router, type RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { requirePermission } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { idParamsSchema } from '../../validators/common.validators.js';
import { curriculumController as c } from './curriculum.controller.js';

/**
 * `/api/v1/admin/...` curriculum routes — `content.manage` at the route, plus the per-course
 * `accessPolicy` check in the service. `:id` is always the PARENT for collection routes
 * (`/courses/:id/modules`) and the item itself for item routes (`/modules/:id`).
 */
export const curriculumAdminRouter = Router();

const allowed = requirePermission(PERMISSIONS.CONTENT_MANAGE);
const byId = validateRequest({ params: idParamsSchema });
const withBody = (body: ZodType): RequestHandler =>
  validateRequest({ params: idParamsSchema, body });
const reorder = withBody(reorderSchema);

const r = curriculumAdminRouter;

r.get('/courses/:id/curriculum', allowed, byId, c.tree);

r.get('/courses/:id/modules', allowed, byId, c.listModules);
r.post('/courses/:id/modules', allowed, withBody(moduleCreateSchema), c.createModule);
r.put('/courses/:id/modules/order', allowed, reorder, c.reorderModules);
r.patch('/modules/:id', allowed, withBody(moduleUpdateSchema), c.updateModule);
r.delete('/modules/:id', allowed, byId, c.deleteModule);

r.get('/modules/:id/chapters', allowed, byId, c.listChapters);
r.post('/modules/:id/chapters', allowed, withBody(chapterCreateSchema), c.createChapter);
r.put('/modules/:id/chapters/order', allowed, reorder, c.reorderChapters);
r.patch('/chapters/:id', allowed, withBody(chapterUpdateSchema), c.updateChapter);
r.delete('/chapters/:id', allowed, byId, c.deleteChapter);

r.get('/chapters/:id/lessons', allowed, byId, c.listLessons);
r.post('/chapters/:id/lessons', allowed, withBody(lessonCreateSchema), c.createLesson);
r.put('/chapters/:id/lessons/order', allowed, reorder, c.reorderLessons);
r.get('/lessons/:id', allowed, byId, c.getLesson);
r.patch('/lessons/:id', allowed, withBody(lessonUpdateSchema), c.updateLesson);
r.delete('/lessons/:id', allowed, byId, c.deleteLesson);

r.get('/lessons/:id/resources', allowed, byId, c.listResources);
r.post('/lessons/:id/resources', allowed, withBody(resourceInputSchema), c.createResource);
r.put('/lessons/:id/resources/order', allowed, reorder, c.reorderResources);
r.patch('/resources/:id', allowed, withBody(resourceUpdateSchema), c.updateResource);
r.delete('/resources/:id', allowed, byId, c.deleteResource);
