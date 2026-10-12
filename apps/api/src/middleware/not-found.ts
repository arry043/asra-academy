import type { Request, Response } from 'express';
import { sendError } from '../utils/api-response.js';

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`);
}
