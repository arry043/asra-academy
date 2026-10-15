import type {
  AdminCourseListQuery,
  CourseCreateInput,
  CourseInstructorsInput,
  CourseTransitionInput,
  CourseUpdateInput,
  FacultyOptionsQuery,
  PublicCourseListQuery,
} from '@asra/validation';
import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { courseService } from './courses.service.js';
import { publicCatalogService } from './public-catalog.service.js';

/** HTTP in/out only — rules live in the services. Input was validated by `validateRequest`. */
const id = (req: Request) => String(req.params.id);

export const courseController = {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await courseService.list(req.query as unknown as AdminCourseListQuery));
  },
  async get(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await courseService.get(id(req)));
  },
  async create(req: Request, res: Response): Promise<void> {
    sendSuccess(
      res,
      await courseService.create(req.body as CourseCreateInput),
      'Course created',
      201,
    );
  },
  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(
      res,
      await courseService.update(id(req), req.body as CourseUpdateInput),
      'Course updated',
    );
  },
  async remove(req: Request, res: Response): Promise<void> {
    await courseService.remove(id(req));
    sendSuccess(res, null, 'Course deleted');
  },
  async setInstructors(req: Request, res: Response): Promise<void> {
    const body = req.body as CourseInstructorsInput;
    sendSuccess(res, await courseService.setInstructors(id(req), body), 'Faculty assignment saved');
  },
  async publish(req: Request, res: Response): Promise<void> {
    const body = req.body as CourseTransitionInput;
    sendSuccess(res, await courseService.publish(id(req), body), 'Course published');
  },
  async unpublish(req: Request, res: Response): Promise<void> {
    const body = req.body as CourseTransitionInput;
    sendSuccess(res, await courseService.unpublish(id(req), body), 'Course unpublished');
  },
  async archive(req: Request, res: Response): Promise<void> {
    const body = req.body as CourseTransitionInput;
    sendSuccess(res, await courseService.archive(id(req), body), 'Course archived');
  },
  async restore(req: Request, res: Response): Promise<void> {
    const body = req.body as CourseTransitionInput;
    sendSuccess(res, await courseService.restore(id(req), body), 'Course restored to draft');
  },
  async facultyOptions(req: Request, res: Response): Promise<void> {
    sendSuccess(
      res,
      await courseService.facultyOptions(req.query as unknown as FacultyOptionsQuery),
    );
  },
};

export const publicCourseController = {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(
      res,
      await publicCatalogService.list(req.query as unknown as PublicCourseListQuery),
    );
  },
  async get(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await publicCatalogService.getBySlug(String(req.params.slug)));
  },
};
