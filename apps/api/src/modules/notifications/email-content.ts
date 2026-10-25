import { safeExternalUrlSchema } from '@asra/validation';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { clock } from '../../lib/clock.js';
import { formatInZone, timeZoneLabel } from '../../lib/time-zone.js';
import {
  renderBrandedEmail,
  type BrandedEmailInput,
  type RenderedEmail,
} from '../../email/templates.js';

/**
 * Turns a stored notification into an email (PHASE 11). Rendered when the email is SENT, not when
 * the event happened, so a retried email never shows a stale class time, and a "scheduled" email
 * for a class that was cancelled (or has ended) in the meantime is skipped instead of misleading.
 */

export interface EmailableNotification {
  id: string;
  event: string;
  title: string;
  message: string;
  actionUrl: string | null;
  resourceId: string | null;
  data: Prisma.JsonValue;
  user: { fullName: string };
}

/** Why an email is no longer appropriate (stored as the delivery's note). */
export class EmailNotApplicable extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'EmailNotApplicable';
  }
}

const storedDetails = z.object({
  details: z.array(z.object({ label: z.string(), value: z.string() })).max(10),
});

const ACTION_LABELS: Record<string, string> = {
  registration: 'Open your dashboard',
  enrollment: 'Open the course',
  live_class: 'Open your classes',
  assignment: 'Open the assignment',
  examination: 'View the exam',
  result: 'View your results',
  payment: 'View your payments',
  certificate: 'View your certificate',
};

const absolute = (path: string) => new URL(path, env.NEXT_PUBLIC_APP_URL).toString();

async function liveClassContent(
  notification: EmailableNotification,
): Promise<Pick<BrandedEmailInput, 'details' | 'links' | 'footnote'>> {
  const live = notification.resourceId
    ? await prisma.liveClassSession.findUnique({
        where: { id: notification.resourceId },
        select: {
          status: true,
          startsAt: true,
          durationMinutes: true,
          timeZone: true,
          joinUrl: true,
          course: { select: { title: true } },
          host: { select: { user: { select: { fullName: true } } } },
        },
      })
    : null;
  if (!live) throw new EmailNotApplicable('Live class no longer exists');
  const ended = live.startsAt.getTime() + live.durationMinutes * 60_000 <= clock.now().getTime();
  const cancelledNotice = notification.event === 'live_class.cancelled';
  if (!cancelledNotice && (live.status !== 'SCHEDULED' || ended)) {
    throw new EmailNotApplicable('Live class is no longer upcoming');
  }
  const link =
    !cancelledNotice && live.joinUrl ? safeExternalUrlSchema.safeParse(live.joinUrl) : null;
  return {
    details: [
      { label: 'Course', value: live.course.title },
      ...(live.host ? [{ label: 'Faculty', value: live.host.user.fullName }] : []),
      { label: 'Starts', value: formatInZone(live.startsAt, live.timeZone) },
      { label: 'Duration', value: `${live.durationMinutes} minutes` },
      { label: 'Time zone', value: timeZoneLabel(live.timeZone) },
    ],
    links: link?.success ? [{ label: 'Join the class', url: link.data }] : [],
    footnote: cancelledNotice
      ? undefined
      : 'Join with the account you use for classes. The joining link is personal to students of this course — please do not share it.',
  };
}

export async function buildNotificationEmail(
  notification: EmailableNotification,
): Promise<RenderedEmail> {
  const family = notification.event.split('.')[0] ?? '';
  const stored = storedDetails.safeParse(notification.data);
  const extra =
    family === 'live_class'
      ? await liveClassContent(notification)
      : { details: stored.success ? stored.data.details : [], links: [] };
  return renderBrandedEmail({
    recipientName: notification.user.fullName,
    subject: notification.title,
    heading: notification.title,
    intro: notification.message,
    ...extra,
    ...(notification.actionUrl
      ? {
          action: {
            label: ACTION_LABELS[family] ?? 'Open ASRA Academy',
            url: absolute(notification.actionUrl),
          },
        }
      : {}),
  });
}
