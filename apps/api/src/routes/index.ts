import { Router } from 'express';
import { healthRouter } from './health.routes.js';

/** Root router for `/api/v1`. Business modules register their routers here from PHASE 02. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
