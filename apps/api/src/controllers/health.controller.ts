import type { Request, Response } from 'express';
import { APP_NAME } from '../config/constants.js';
import { healthService } from '../services/health.service.js';
import { sendError, sendSuccess } from '../utils/api-response.js';

export const healthController = {
  /** Liveness: the process is up and serving requests. */
  liveness(_req: Request, res: Response): void {
    sendSuccess(res, healthService.getLiveness(), 'ASRA Academy API is running');
  },

  /** Readiness: PostgreSQL and Redis are reachable. */
  async readiness(_req: Request, res: Response): Promise<void> {
    const data = await healthService.getReadiness();
    if (data.database === 'up' && data.redis === 'up') {
      sendSuccess(res, data, `${APP_NAME} is ready`);
      return;
    }
    sendError(res, 503, 'SERVICE_UNAVAILABLE', 'One or more dependencies are unavailable', data);
  },
};
