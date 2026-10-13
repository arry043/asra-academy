import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

export interface RequestSchemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

/**
 * Validates `req.params`, `req.query` and/or `req.body` with Zod before the controller runs.
 * Parsed values (with coercions/defaults/transforms applied) replace the raw input, so
 * controllers only ever see validated data. Failures reach the central error handler as a
 * ZodError → 422 VALIDATION_ERROR.
 *
 *   router.get('/:id', validateRequest({ params: idParamsSchema }), controller.getById);
 */
export function validateRequest(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as Request['params'];
    }
    if (schemas.query) {
      // Express 5 exposes `req.query` as a getter; shadow it with the parsed value.
      Object.defineProperty(req, 'query', {
        value: schemas.query.parse(req.query),
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    next();
  };
}
