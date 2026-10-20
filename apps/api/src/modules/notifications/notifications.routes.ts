import { notificationListQuerySchema, type NotificationListQuery } from '@asra/validation';
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { sendSuccess } from '../../utils/api-response.js';
import { idParamsSchema } from '../../validators/common.validators.js';
import { notificationService } from './notifications.service.js';

/**
 * `/api/v1/notifications/*` — the signed-in user's in-app notifications (PHASE 11). Any
 * authenticated role may use it; every query is scoped to `req.auth.userId` in the service, so no
 * request value can reach another user's rows. Responses are never cached.
 */
export const notificationsRouter = Router();

notificationsRouter.use(authenticate, (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

notificationsRouter.get(
  '/',
  validateRequest({ query: notificationListQuerySchema }),
  async (req: Request, res: Response) => {
    const query = req.query as unknown as NotificationListQuery;
    sendSuccess(res, await notificationService.list(req.auth!, query));
  },
);

notificationsRouter.get('/unread-count', async (req: Request, res: Response) => {
  sendSuccess(res, await notificationService.unreadCount(req.auth!));
});

notificationsRouter.post('/read-all', async (req: Request, res: Response) => {
  sendSuccess(
    res,
    await notificationService.markAllRead(req.auth!),
    'All notifications marked as read',
  );
});

notificationsRouter.post(
  '/:id/read',
  validateRequest({ params: idParamsSchema }),
  async (req: Request, res: Response) => {
    sendSuccess(
      res,
      await notificationService.markRead(req.auth!, String(req.params.id)),
      'Notification marked as read',
    );
  },
);
