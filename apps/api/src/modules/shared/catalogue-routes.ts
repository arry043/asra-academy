import type { PermissionKey } from '@asra/types';
import { catalogueListQuerySchema } from '@asra/validation';
import type { Router } from 'express';
import type { ZodType } from 'zod';
import { requirePermission } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { idParamsSchema } from '../../validators/common.validators.js';
import { createCrudController, type CrudService } from './crud-controller.js';

/**
 * Registers list/get/create/update/delete for one catalogue resource. Every route checks the
 * permission itself (not the router), so routers mounted side by side under `/admin` never
 * apply each other's requirements.
 */
export function registerCatalogueRoutes<TQuery, TCreate, TUpdate, TDto, TList>(
  router: Router,
  path: string,
  options: {
    service: CrudService<TQuery, TCreate, TUpdate, TDto, TList>;
    label: string;
    permission: PermissionKey;
    createSchema: ZodType;
    updateSchema: ZodType;
  },
): void {
  const controller = createCrudController(options.service, options.label);
  const allowed = requirePermission(options.permission);
  const byId = validateRequest({ params: idParamsSchema });

  router.get(path, allowed, validateRequest({ query: catalogueListQuerySchema }), controller.list);
  router.post(path, allowed, validateRequest({ body: options.createSchema }), controller.create);
  router.get(`${path}/:id`, allowed, byId, controller.get);
  router.patch(
    `${path}/:id`,
    allowed,
    validateRequest({ params: idParamsSchema, body: options.updateSchema }),
    controller.update,
  );
  router.delete(`${path}/:id`, allowed, byId, controller.remove);
}
