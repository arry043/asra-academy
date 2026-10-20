import { z } from 'zod';
import { paginationQuerySchema } from './common.js';

/** In-app notifications (PHASE 11, docs/NOTIFICATIONS.md). */

export const NOTIFICATION_FILTERS = ['all', 'unread'] as const;

export const notificationListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(NOTIFICATION_FILTERS).default('all'),
});
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
