import { PERMISSIONS } from '@asra/types';
import {
  assignmentCreateSchema,
  assignmentSettingsSchema,
  facultyAssignmentListQuerySchema,
  facultyCourseListQuerySchema,
  facultyLessonListQuerySchema,
  facultyProfileUpdateSchema,
  facultyStudentListQuerySchema,
  gradeSubmissionSchema,
  liveClassCreateSchema,
  liveClassListQuerySchema,
  liveClassUpdateSchema,
  submissionListQuerySchema,
} from '@asra/validation';
import { Router, type RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission, requireRole } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { idParamsSchema } from '../../validators/common.validators.js';
import { curriculumFacultyRouter } from '../curriculum/curriculum.routes.js';
import { facultyController as c } from './faculty.controller.js';

/**
 * `/api/v1/faculty/*` — the faculty portal (PHASE 08, docs/FACULTY-PORTAL.md §4).
 *
 * Every request: `authenticate` → `requireRole('FACULTY')` → `no-store`. Each route then requires
 * its permission, and the services check the per-course assignment (`CourseInstructor`) for the
 * course resolved from the DATABASE. Holding a faculty profile grants nothing by itself, and no
 * route here changes roles, assignments, enrolments, payments or course publication.
 */
export const facultyRouter = Router();

facultyRouter.use(authenticate, requireRole('FACULTY'), (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const content = requirePermission(PERMISSIONS.CONTENT_MANAGE_ASSIGNED);
const students = requirePermission(PERMISSIONS.STUDENTS_VIEW_ASSIGNED);
const grading = requirePermission(PERMISSIONS.SUBMISSIONS_GRADE_ASSIGNED);
const classes = requirePermission(PERMISSIONS.LIVE_CLASSES_MANAGE_ASSIGNED);
const own = requirePermission(PERMISSIONS.PROFILE_MANAGE_OWN);
const byId = validateRequest({ params: idParamsSchema });
const withBody = (body: ZodType): RequestHandler =>
  validateRequest({ params: idParamsSchema, body });
const withQuery = (query: ZodType): RequestHandler => validateRequest({ query });

const r = facultyRouter;

r.get('/dashboard', content, c.dashboard);
r.get('/features', c.features);

r.get('/courses', content, withQuery(facultyCourseListQuerySchema), c.courses);
r.get('/courses/:id', content, byId, c.course);
r.get('/courses/:id/performance', students, byId, c.performance);
r.get('/students', students, withQuery(facultyStudentListQuerySchema), c.students);
r.get('/lessons', content, withQuery(facultyLessonListQuerySchema), c.lessons);

// Curriculum: same routes and service as /admin, limited to assigned courses by the service.
r.use(curriculumFacultyRouter);

r.get('/assignments', content, withQuery(facultyAssignmentListQuerySchema), c.assignments);
r.get('/assignments/:id', content, byId, c.assignment);
r.post('/chapters/:id/assignments', content, withBody(assignmentCreateSchema), c.createAssignment);
r.put(
  '/lessons/:id/assignment',
  content,
  withBody(assignmentSettingsSchema),
  c.saveAssignmentSettings,
);

r.get('/submissions', grading, withQuery(submissionListQuerySchema), c.submissions);
r.get('/submissions/:id', grading, byId, c.submission);
r.put('/submissions/:id/grade', grading, withBody(gradeSubmissionSchema), c.grade);
r.post('/submissions/:id/release', grading, byId, c.release);

r.get('/live-classes', classes, withQuery(liveClassListQuerySchema), c.liveClasses);
r.post('/courses/:id/live-classes', classes, withBody(liveClassCreateSchema), c.createLiveClass);
r.patch('/live-classes/:id', classes, withBody(liveClassUpdateSchema), c.updateLiveClass);
r.post('/live-classes/:id/cancel', classes, byId, c.cancelLiveClass);

r.get('/profile', own, c.profile);
r.patch('/profile', own, validateRequest({ body: facultyProfileUpdateSchema }), c.updateProfile);
