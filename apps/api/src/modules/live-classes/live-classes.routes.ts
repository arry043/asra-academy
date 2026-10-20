import { PERMISSIONS } from '@asra/types';
import {
  adminLiveClassCreateSchema,
  adminLiveClassListQuerySchema,
  adminLiveClassUpdateSchema,
  liveClassRecordingSchema,
  type AdminLiveClassCreateInput,
  type AdminLiveClassListQuery,
  type AdminLiveClassUpdateInput,
  type LiveClassRecordingInput,
} from '@asra/validation';
import { Router, type Request, type Response } from 'express';
import { requirePermission } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { sendSuccess } from '../../utils/api-response.js';
import { idParamsSchema } from '../../validators/common.validators.js';
import { liveClassService, type LiveClassCreateResult } from './live-classes.service.js';

/**
 * `/api/v1/admin/live-classes/*` (PHASE 11, docs/LIVE-CLASSES.md §7). Mounted behind
 * `authenticate` in routes/index.ts; every route requires `live_classes.manage`, and the service
 * re-checks it and validates course, host assignment and class state.
 */
export const liveClassesAdminRouter = Router();

const allowed = requirePermission(PERMISSIONS.LIVE_CLASSES_MANAGE);
const byId = validateRequest({ params: idParamsSchema });
const id = (req: Request) => String(req.params.id);

/** "Scheduled" — or an honest note that the class exists but its Google link does not. */
export function createdMessage(result: LiveClassCreateResult): string {
  return result.meetingError
    ? `Live class scheduled, but the Google Meet link could not be created: ${result.meetingError}`
    : 'Live class scheduled';
}

const r = liveClassesAdminRouter;

r.get('/live-classes/settings', allowed, (_req: Request, res: Response) => {
  sendSuccess(res, liveClassService.settings());
});

r.get(
  '/live-classes',
  allowed,
  validateRequest({ query: adminLiveClassListQuerySchema }),
  async (req: Request, res: Response) => {
    const query = req.query as unknown as AdminLiveClassListQuery;
    sendSuccess(res, await liveClassService.adminList(req.auth!, query));
  },
);

r.post(
  '/live-classes',
  allowed,
  validateRequest({ body: adminLiveClassCreateSchema }),
  async (req: Request, res: Response) => {
    const result = await liveClassService.adminCreate(
      req.auth!,
      req.body as AdminLiveClassCreateInput,
    );
    sendSuccess(res, result.liveClass, createdMessage(result), 201);
  },
);

r.get('/courses/:id/live-class-hosts', allowed, byId, async (req: Request, res: Response) => {
  sendSuccess(res, await liveClassService.adminHostOptions(req.auth!, id(req)));
});

r.get('/live-classes/:id', allowed, byId, async (req: Request, res: Response) => {
  sendSuccess(res, await liveClassService.adminDetail(req.auth!, id(req)));
});

r.patch(
  '/live-classes/:id',
  allowed,
  validateRequest({ params: idParamsSchema, body: adminLiveClassUpdateSchema }),
  async (req: Request, res: Response) => {
    const data = await liveClassService.adminUpdate(
      req.auth!,
      id(req),
      req.body as AdminLiveClassUpdateInput,
    );
    sendSuccess(res, data, 'Live class updated');
  },
);

r.post('/live-classes/:id/cancel', allowed, byId, async (req: Request, res: Response) => {
  const { cancelled, liveClass } = await liveClassService.adminCancel(req.auth!, id(req));
  sendSuccess(
    res,
    liveClass,
    cancelled ? 'Live class cancelled' : 'Live class was already cancelled',
  );
});

r.post('/live-classes/:id/complete', allowed, byId, async (req: Request, res: Response) => {
  const { completed, liveClass } = await liveClassService.adminComplete(req.auth!, id(req));
  sendSuccess(
    res,
    liveClass,
    completed ? 'Live class marked as completed' : 'Live class was already completed',
  );
});

r.post('/live-classes/:id/meeting', allowed, byId, async (req: Request, res: Response) => {
  const { created, liveClass } = await liveClassService.adminRequestMeeting(req.auth!, id(req));
  sendSuccess(
    res,
    liveClass,
    created ? 'Google Meet link created' : 'Google Meet link already exists',
  );
});

r.put(
  '/live-classes/:id/recording',
  allowed,
  validateRequest({ params: idParamsSchema, body: liveClassRecordingSchema }),
  async (req: Request, res: Response) => {
    const input = req.body as LiveClassRecordingInput;
    const data = await liveClassService.adminSetRecording(req.auth!, id(req), input);
    sendSuccess(res, data, input.recordingUrl ? 'Recording link saved' : 'Recording link removed');
  },
);
