import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { academicsAdminRouter } from '../modules/academics/academics.routes.js';
import { coursesAdminRouter, publicCoursesRouter } from '../modules/courses/courses.routes.js';
import { curriculumAdminRouter } from '../modules/curriculum/curriculum.routes.js';
import { enrollmentsAdminRouter } from '../modules/enrollments/enrollments.routes.js';
import { facultyRouter } from '../modules/faculty/faculty.routes.js';
import { studentRouter } from '../modules/student/student.routes.js';
import { authRouter } from './auth.routes.js';
import { healthRouter } from './health.routes.js';

/** Root router for `/api/v1`. Business modules register their routers here. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);

/** Public, read-only catalogue (published courses only). */
apiRouter.use('/courses', publicCoursesRouter);

/**
 * Administration (PHASE 06). Every request is authenticated here; each route then requires its
 * own permission (`academic_structure.manage`, `courses.manage` or `content.manage`), and the
 * services apply resource-level policies. Responses are never cached.
 */
const adminRouter = Router();
adminRouter.use(authenticate, (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
adminRouter.use(academicsAdminRouter);
adminRouter.use(coursesAdminRouter);
adminRouter.use(curriculumAdminRouter);
adminRouter.use(enrollmentsAdminRouter);
apiRouter.use('/admin', adminRouter);

/**
 * Student portal (PHASE 07): authenticated STUDENT accounts only; every course-content endpoint
 * also checks the per-course enrolment policy. See modules/student/student.routes.ts.
 */
apiRouter.use('/student', studentRouter);

/**
 * Faculty portal (PHASE 08): authenticated FACULTY accounts only; every course endpoint also
 * checks the faculty member's course assignment. See modules/faculty/faculty.routes.ts.
 */
apiRouter.use('/faculty', facultyRouter);
