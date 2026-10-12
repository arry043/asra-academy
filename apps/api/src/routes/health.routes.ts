import { Router } from 'express';
import { healthController } from '../controllers/health.controller.js';

export const healthRouter = Router();

healthRouter.get('/', healthController.liveness);
healthRouter.get('/ready', healthController.readiness);
