import type {
  PaginationQuery,
  StudentCatalogQuery,
  StudentEnrollmentListQuery,
  StudentLessonListQuery,
  StudentProfileUpdateInput,
  VideoProgressInput,
} from '@asra/validation';
import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { studentService } from './student.service.js';

/**
 * HTTP in/out only. `req.auth` is guaranteed by `authenticate` + `requireRole('STUDENT')`;
 * params, queries and bodies were validated by `validateRequest`. The student is always
 * `req.auth.userId` — no handler reads a user id from the request.
 */
const auth = (req: Request) => req.auth!;
const id = (req: Request) => String(req.params.id);
const query = <T>(req: Request) => req.query as unknown as T;
const body = <T>(req: Request) => req.body as T;

export const studentController = {
  async dashboard(req: Request, res: Response) {
    sendSuccess(res, await studentService.dashboard(auth(req)));
  },
  features(_req: Request, res: Response) {
    sendSuccess(res, studentService.features());
  },

  async courses(req: Request, res: Response) {
    sendSuccess(res, await studentService.courses(auth(req), query<PaginationQuery>(req)));
  },
  async enrollments(req: Request, res: Response) {
    sendSuccess(
      res,
      await studentService.enrollments(auth(req), query<StudentEnrollmentListQuery>(req)),
    );
  },
  async catalog(req: Request, res: Response) {
    sendSuccess(res, await studentService.catalog(auth(req), query<StudentCatalogQuery>(req)));
  },
  async enroll(req: Request, res: Response) {
    const { created, course } = await studentService.enrollFree(auth(req), id(req));
    sendSuccess(
      res,
      course,
      created ? 'Enrolled' : 'You are already enrolled in this course',
      created ? 201 : 200,
    );
  },

  async courseOverview(req: Request, res: Response) {
    sendSuccess(res, await studentService.courseOverview(auth(req), id(req)));
  },
  async curriculum(req: Request, res: Response) {
    sendSuccess(res, await studentService.curriculum(auth(req), id(req)));
  },
  async courseProgress(req: Request, res: Response) {
    sendSuccess(res, await studentService.courseProgress(auth(req), id(req)));
  },

  async lessons(req: Request, res: Response) {
    sendSuccess(
      res,
      await studentService.lessonsByType(auth(req), query<StudentLessonListQuery>(req)),
    );
  },
  async lesson(req: Request, res: Response) {
    sendSuccess(res, await studentService.lesson(auth(req), id(req)));
  },
  async lessonResources(req: Request, res: Response) {
    sendSuccess(res, await studentService.lessonResources(auth(req), id(req)));
  },
  async recordActivity(req: Request, res: Response) {
    sendSuccess(res, await studentService.recordActivity(auth(req), id(req)), 'Activity recorded');
  },
  async complete(req: Request, res: Response) {
    sendSuccess(res, await studentService.complete(auth(req), id(req)), 'Lesson completed');
  },
  async reopen(req: Request, res: Response) {
    sendSuccess(
      res,
      await studentService.reopen(auth(req), id(req)),
      'Lesson marked as not complete',
    );
  },
  async videoProgress(req: Request, res: Response) {
    sendSuccess(
      res,
      await studentService.recordVideoProgress(auth(req), id(req), body<VideoProgressInput>(req)),
      'Progress saved',
    );
  },

  async history(req: Request, res: Response) {
    sendSuccess(res, await studentService.history(auth(req), query<PaginationQuery>(req)));
  },

  async profile(req: Request, res: Response) {
    sendSuccess(res, await studentService.profile(auth(req)));
  },
  async updateProfile(req: Request, res: Response) {
    sendSuccess(
      res,
      await studentService.updateProfile(auth(req), body<StudentProfileUpdateInput>(req)),
      'Profile updated',
    );
  },
};
