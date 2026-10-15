import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { curriculumService } from './curriculum.service.js';

/**
 * HTTP in/out only. `req.auth` is guaranteed by `authenticate`; params and bodies were validated
 * by `validateRequest`. Access to the owning course is checked in the service.
 */
const auth = (req: Request) => req.auth!;
const id = (req: Request) => String(req.params.id);
const body = <T>(req: Request) => req.body as T;
type Input<K extends keyof typeof curriculumService> = Parameters<(typeof curriculumService)[K]>[2];

export const curriculumController = {
  async tree(req: Request, res: Response) {
    sendSuccess(res, await curriculumService.tree(auth(req), id(req)));
  },

  async listModules(req: Request, res: Response) {
    sendSuccess(res, await curriculumService.listModules(auth(req), id(req)));
  },
  async createModule(req: Request, res: Response) {
    const data = await curriculumService.createModule(
      auth(req),
      id(req),
      body<Input<'createModule'>>(req),
    );
    sendSuccess(res, data, 'Module created', 201);
  },
  async updateModule(req: Request, res: Response) {
    const data = await curriculumService.updateModule(
      auth(req),
      id(req),
      body<Input<'updateModule'>>(req),
    );
    sendSuccess(res, data, 'Module updated');
  },
  async deleteModule(req: Request, res: Response) {
    await curriculumService.deleteModule(auth(req), id(req));
    sendSuccess(res, null, 'Module deleted');
  },
  async reorderModules(req: Request, res: Response) {
    const data = await curriculumService.reorderModules(
      auth(req),
      id(req),
      body<Input<'reorderModules'>>(req),
    );
    sendSuccess(res, data, 'Module order saved');
  },

  async listChapters(req: Request, res: Response) {
    sendSuccess(res, await curriculumService.listChapters(auth(req), id(req)));
  },
  async createChapter(req: Request, res: Response) {
    const data = await curriculumService.createChapter(
      auth(req),
      id(req),
      body<Input<'createChapter'>>(req),
    );
    sendSuccess(res, data, 'Chapter created', 201);
  },
  async updateChapter(req: Request, res: Response) {
    const data = await curriculumService.updateChapter(
      auth(req),
      id(req),
      body<Input<'updateChapter'>>(req),
    );
    sendSuccess(res, data, 'Chapter updated');
  },
  async deleteChapter(req: Request, res: Response) {
    await curriculumService.deleteChapter(auth(req), id(req));
    sendSuccess(res, null, 'Chapter deleted');
  },
  async reorderChapters(req: Request, res: Response) {
    const data = await curriculumService.reorderChapters(
      auth(req),
      id(req),
      body<Input<'reorderChapters'>>(req),
    );
    sendSuccess(res, data, 'Chapter order saved');
  },

  async listLessons(req: Request, res: Response) {
    sendSuccess(res, await curriculumService.listLessons(auth(req), id(req)));
  },
  async getLesson(req: Request, res: Response) {
    sendSuccess(res, await curriculumService.getLesson(auth(req), id(req)));
  },
  async createLesson(req: Request, res: Response) {
    const data = await curriculumService.createLesson(
      auth(req),
      id(req),
      body<Input<'createLesson'>>(req),
    );
    sendSuccess(res, data, 'Lesson created', 201);
  },
  async updateLesson(req: Request, res: Response) {
    const data = await curriculumService.updateLesson(
      auth(req),
      id(req),
      body<Input<'updateLesson'>>(req),
    );
    sendSuccess(res, data, 'Lesson updated');
  },
  async deleteLesson(req: Request, res: Response) {
    await curriculumService.deleteLesson(auth(req), id(req));
    sendSuccess(res, null, 'Lesson deleted');
  },
  async reorderLessons(req: Request, res: Response) {
    const data = await curriculumService.reorderLessons(
      auth(req),
      id(req),
      body<Input<'reorderLessons'>>(req),
    );
    sendSuccess(res, data, 'Lesson order saved');
  },

  async listResources(req: Request, res: Response) {
    sendSuccess(res, await curriculumService.listResources(auth(req), id(req)));
  },
  async createResource(req: Request, res: Response) {
    const data = await curriculumService.createResource(
      auth(req),
      id(req),
      body<Input<'createResource'>>(req),
    );
    sendSuccess(res, data, 'Resource added', 201);
  },
  async updateResource(req: Request, res: Response) {
    const data = await curriculumService.updateResource(
      auth(req),
      id(req),
      body<Input<'updateResource'>>(req),
    );
    sendSuccess(res, data, 'Resource updated');
  },
  async deleteResource(req: Request, res: Response) {
    await curriculumService.deleteResource(auth(req), id(req));
    sendSuccess(res, null, 'Resource removed');
  },
  async reorderResources(req: Request, res: Response) {
    const data = await curriculumService.reorderResources(
      auth(req),
      id(req),
      body<Input<'reorderResources'>>(req),
    );
    sendSuccess(res, data, 'Resource order saved');
  },
};
