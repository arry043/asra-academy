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
import {
  PUBLIC_CATALOGUE_CACHE_CONTROL,
  SITEMAP_FEED_CACHE_CONTROL,
} from '../../config/constants.js';
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
    sendSuccess(
      res,
      await courseService.setInstructors(id(req), body, req.auth!.userId),
      'Faculty assignment saved',
    );
  },
  async publish(req: Request, res: Response): Promise<void> {
    const body = req.body as CourseTransitionInput;
    sendSuccess(
      res,
      await courseService.publish(id(req), body, req.auth!.userId),
      'Course published',
    );
  },
  async unpublish(req: Request, res: Response): Promise<void> {
    const body = req.body as CourseTransitionInput;
    sendSuccess(
      res,
      await courseService.unpublish(id(req), body, req.auth!.userId),
      'Course unpublished',
    );
  },
  async archive(req: Request, res: Response): Promise<void> {
    const body = req.body as CourseTransitionInput;
    sendSuccess(
      res,
      await courseService.archive(id(req), body, req.auth!.userId),
      'Course archived',
    );
  },
  async restore(req: Request, res: Response): Promise<void> {
    const body = req.body as CourseTransitionInput;
    sendSuccess(
      res,
      await courseService.restore(id(req), body, req.auth!.userId),
      'Course restored to draft',
    );
  },
  async facultyOptions(req: Request, res: Response): Promise<void> {
    sendSuccess(
      res,
      await courseService.facultyOptions(req.query as unknown as FacultyOptionsQuery),
    );
  },
};

/** Public responses become cacheable only once they succeeded — errors keep the `no-store` default. */
export const publicCourseController = {
  async list(req: Request, res: Response): Promise<void> {
    const data = await publicCatalogService.list(req.query as unknown as PublicCourseListQuery);
    res.setHeader('Cache-Control', PUBLIC_CATALOGUE_CACHE_CONTROL);
    sendSuccess(res, data);
  },
  async get(req: Request, res: Response): Promise<void> {
    const data = await publicCatalogService.getBySlug(String(req.params.slug));
    res.setHeader('Cache-Control', PUBLIC_CATALOGUE_CACHE_CONTROL);
    sendSuccess(res, data);
  },
  async sitemap(_req: Request, res: Response): Promise<void> {
    const data = await publicCatalogService.sitemapEntries();
    res.setHeader('Cache-Control', SITEMAP_FEED_CACHE_CONTROL);
    sendSuccess(res, data);
  },
};
