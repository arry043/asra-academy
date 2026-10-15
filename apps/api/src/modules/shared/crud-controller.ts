import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';

/** The service surface a catalogue resource exposes to HTTP. */
export interface CrudService<TQuery, TCreate, TUpdate, TDto, TList> {
  list(query: TQuery): Promise<TList>;
  get(id: string): Promise<TDto>;
  create(input: TCreate): Promise<TDto>;
  update(id: string, input: TUpdate): Promise<TDto>;
  remove(id: string): Promise<void>;
}

/**
 * Controller for a catalogue resource: HTTP in/out only. Params, query and body were already
 * validated (and stripped of unknown keys) by `validateRequest`, so they are passed straight on.
 */
export function createCrudController<TQuery, TCreate, TUpdate, TDto, TList>(
  service: CrudService<TQuery, TCreate, TUpdate, TDto, TList>,
  label: string,
) {
  return {
    async list(req: Request, res: Response): Promise<void> {
      sendSuccess(res, await service.list(req.query as TQuery));
    },
    async get(req: Request, res: Response): Promise<void> {
      sendSuccess(res, await service.get(String(req.params.id)));
    },
    async create(req: Request, res: Response): Promise<void> {
      sendSuccess(res, await service.create(req.body as TCreate), `${label} created`, 201);
    },
    async update(req: Request, res: Response): Promise<void> {
      sendSuccess(
        res,
        await service.update(String(req.params.id), req.body as TUpdate),
        `${label} updated`,
      );
    },
    async remove(req: Request, res: Response): Promise<void> {
      await service.remove(String(req.params.id));
      sendSuccess(res, null, `${label} deleted`);
    },
  };
}
