import { formatInZone } from '../../lib/time-zone.js';
import type { NotificationSpec } from './notifications.service.js';

/**
 * The notification catalogue (PHASE 11, docs/NOTIFICATIONS.md §3): one builder per business
 * event, deciding type, wording, link, idempotency key and channels. Producers call these from
 * the canonical place where the event becomes true (after verification, inside the transaction
 * that commits it) — never from the browser or from a redirect.
 *
 * Channels: payment and refund emails already exist (PHASE 10, sent exactly once by
 * payments/notifications.ts), so those events are in-app only here to avoid duplicate emails.
 */

type Detail = { label: string; value: string };

const details = (...rows: (Detail | null | false | undefined)[]) => ({
  details: rows.filter((row): row is Detail => Boolean(row)),
});

const quoted = (title: string) => `“${title}”`;

// --- Registration / enrolment / payment ------------------------------------------------------

export const registrationEvents = {
  /** After the email address is verified (the account becomes usable). */
  welcome(): NotificationSpec {
    return {
      type: 'REGISTRATION',
      event: 'registration.welcome',
      title: 'Welcome to ASRA Academy',
      message:
        'Your email address is verified and your student account is ready. Browse the courses and start learning from your dashboard.',
      actionUrl: '/student/dashboard',
      dedupeKey: 'registration.welcome',
      email: true,
    };
  },
};

export const enrollmentEvents = {
  /** FREE self-enrolment or ADMIN enrolment, once the ACTIVE enrolment is committed. */
  activated(input: {
    enrollmentId: string;
    enrolledAt: Date;
    courseId: string;
    courseTitle: string;
    source: 'FREE' | 'ADMIN';
  }): NotificationSpec {
    return {
      type: 'ENROLLMENT',
      event: 'enrollment.activated',
      title: `You are enrolled in ${input.courseTitle}`,
      message:
        input.source === 'ADMIN'
          ? `The academy has enrolled you in ${quoted(input.courseTitle)}. The course is now open in your student portal.`
          : `Your enrolment in ${quoted(input.courseTitle)} is confirmed. The course is now open in your student portal.`,
      actionUrl: `/student/courses/${input.courseId}`,
      resource: { type: 'enrollment', id: input.enrollmentId },
      data: details({ label: 'Course', value: input.courseTitle }),
      // A reactivated enrolment is a new occurrence (new enrolledAt).
      dedupeKey: `enrollment.activated:${input.enrollmentId}:${input.enrolledAt.getTime()}`,
      email: true,
    };
  },
};

export const paymentEvents = {
  /** The order became PAID (verified with Razorpay) and the enrolment is active. In-app only. */
  received(input: { orderId: string; courseTitle: string; amount: string }): NotificationSpec {
    return {
      type: 'PAYMENT',
      event: 'payment.received',
      title: `Payment received — ${input.courseTitle}`,
      message: `We received your payment of ${input.amount}. Your enrolment in ${quoted(input.courseTitle)} is active.`,
      actionUrl: `/student/payments/${input.orderId}/receipt`,
      resource: { type: 'order', id: input.orderId },
      dedupeKey: `payment.received:${input.orderId}`,
      email: false,
    };
  },

  /** A refund was confirmed PROCESSED by Razorpay. In-app only. */
  refundProcessed(input: {
    refundId: string;
    courseTitle: string;
    amount: string;
  }): NotificationSpec {
    return {
      type: 'PAYMENT',
      event: 'payment.refund_processed',
      title: `Refund processed — ${input.courseTitle}`,
      message: `A refund of ${input.amount} for ${quoted(input.courseTitle)} has been processed. Banks usually take 5–7 working days to show it.`,
      actionUrl: '/student/payments',
      resource: { type: 'refund', id: input.refundId },
      dedupeKey: `payment.refund_processed:${input.refundId}`,
      email: false,
    };
  },
};

// --- Live classes -------------------------------------------------------------------------------

export interface LiveClassFacts {
  id: string;
  title: string;
  courseTitle: string;
  host: string | null;
  startsAt: Date;
  durationMinutes: number;
  timeZone: string;
}

function classDetails(facts: LiveClassFacts) {
  return details(
    { label: 'Course', value: facts.courseTitle },
    facts.host ? { label: 'Faculty', value: facts.host } : null,
    { label: 'Starts', value: formatInZone(facts.startsAt, facts.timeZone) },
    { label: 'Duration', value: `${facts.durationMinutes} minutes` },
  );
}

/** `audience` decides the portal link (students and the host faculty member get different ones). */
type Audience = 'student' | 'faculty';
const classesUrl = (audience: Audience) =>
  audience === 'student' ? '/student/classes' : '/faculty/classes';

export const liveClassEvents = {
  scheduled(facts: LiveClassFacts, audience: Audience): NotificationSpec {
    return {
      type: 'LIVE_CLASS',
      event: 'live_class.scheduled',
      title: `Live class scheduled: ${facts.title}`,
      message: `${quoted(facts.title)} (${facts.courseTitle}) is scheduled for ${formatInZone(facts.startsAt, facts.timeZone)}.`,
      actionUrl: classesUrl(audience),
      resource: { type: 'live_class', id: facts.id },
      data: classDetails(facts),
      dedupeKey: `live_class.scheduled:${facts.id}`,
      email: true,
    };
  },

  /**
   * The time, duration or joining link changed. `version` (the row's new updatedAt) makes each
   * real change a separate occurrence; a retried identical request changes nothing and so never
   * reaches this builder.
   */
  updated(
    facts: LiveClassFacts,
    audience: Audience,
    change: { version: Date; scheduleChanged: boolean },
  ): NotificationSpec {
    return {
      type: 'LIVE_CLASS',
      event: 'live_class.updated',
      title: `Live class updated: ${facts.title}`,
      message: change.scheduleChanged
        ? `${quoted(facts.title)} (${facts.courseTitle}) has a new time: ${formatInZone(facts.startsAt, facts.timeZone)}, ${facts.durationMinutes} minutes.`
        : `The joining link for ${quoted(facts.title)} (${facts.courseTitle}) has changed. Open your classes page to join.`,
      actionUrl: classesUrl(audience),
      resource: { type: 'live_class', id: facts.id },
      data: classDetails(facts),
      dedupeKey: `live_class.updated:${facts.id}:${change.version.getTime()}`,
      email: true,
    };
  },

  cancelled(facts: LiveClassFacts, audience: Audience): NotificationSpec {
    return {
      type: 'LIVE_CLASS',
      event: 'live_class.cancelled',
      title: `Live class cancelled: ${facts.title}`,
      message: `${quoted(facts.title)} (${facts.courseTitle}), planned for ${formatInZone(facts.startsAt, facts.timeZone)}, has been cancelled.`,
      actionUrl: classesUrl(audience),
      resource: { type: 'live_class', id: facts.id },
      data: classDetails(facts),
      dedupeKey: `live_class.cancelled:${facts.id}`,
      email: true,
    };
  },

  /** A recording link was added or replaced. In-app only (the link itself stays behind login). */
  recordingAvailable(facts: LiveClassFacts, version: Date): NotificationSpec {
    return {
      type: 'LIVE_CLASS',
      event: 'live_class.recording_available',
      title: `Recording available: ${facts.title}`,
      message: `The recording of ${quoted(facts.title)} (${facts.courseTitle}) is available in your classes page.`,
      actionUrl: '/student/classes?when=past',
      resource: { type: 'live_class', id: facts.id },
      dedupeKey: `live_class.recording_available:${facts.id}:${version.getTime()}`,
      email: false,
    };
  },
};

// --- Assignments, examinations and results ----------------------------------------------------

export const assessmentEvents = {
  /** An ASSIGNMENT lesson was first published in a PUBLISHED course. */
  assignmentPublished(input: {
    lessonId: string;
    courseId: string;
    courseTitle: string;
    title: string;
    dueAt: Date | null;
  }): NotificationSpec {
    const due = input.dueAt ? formatInZone(input.dueAt, 'Asia/Kolkata') : null;
    return {
      type: 'ASSIGNMENT',
      event: 'assignment.published',
      title: `New assignment: ${input.title}`,
      message: `A new assignment ${quoted(input.title)} was added to ${quoted(input.courseTitle)}.${due ? ` Due ${due}.` : ''}`,
      actionUrl: `/student/learn/${input.courseId}?lesson=${input.lessonId}`,
      resource: { type: 'lesson', id: input.lessonId },
      data: details(
        { label: 'Course', value: input.courseTitle },
        due ? { label: 'Due', value: due } : null,
      ),
      dedupeKey: `assignment.published:${input.lessonId}`,
      email: true,
    };
  },

  assignmentResultReleased(input: {
    submissionId: string;
    courseTitle: string;
    title: string;
  }): NotificationSpec {
    return {
      type: 'RESULT',
      event: 'result.assignment_released',
      title: `Result released: ${input.title}`,
      message: `Your faculty has released the result of ${quoted(input.title)} (${input.courseTitle}).`,
      actionUrl: '/student/results',
      resource: { type: 'submission', id: input.submissionId },
      data: details({ label: 'Course', value: input.courseTitle }),
      dedupeKey: `result.assignment_released:${input.submissionId}`,
      email: true,
    };
  },

  /** An examination was published (first publication only). */
  examPublished(input: {
    examId: string;
    courseTitle: string;
    title: string;
    opensAt: Date;
    closesAt: Date;
    durationMinutes: number;
  }): NotificationSpec {
    const opens = formatInZone(input.opensAt, 'Asia/Kolkata');
    const closes = formatInZone(input.closesAt, 'Asia/Kolkata');
    return {
      type: 'EXAMINATION',
      event: 'examination.published',
      title: `Exam scheduled: ${input.title}`,
      message: `${quoted(input.title)} (${input.courseTitle}) opens ${opens} and closes ${closes}.`,
      actionUrl: `/student/exams/${input.examId}`,
      resource: { type: 'examination', id: input.examId },
      data: details(
        { label: 'Course', value: input.courseTitle },
        { label: 'Opens', value: opens },
        { label: 'Closes', value: closes },
        { label: 'Duration', value: `${input.durationMinutes} minutes` },
      ),
      dedupeKey: `examination.published:${input.examId}`,
      email: true,
    };
  },

  examResultsPublished(input: {
    examId: string;
    courseTitle: string;
    title: string;
  }): NotificationSpec {
    return {
      type: 'RESULT',
      event: 'result.exam_published',
      title: `Exam results published: ${input.title}`,
      message: `Results of ${quoted(input.title)} (${input.courseTitle}) are now available.`,
      actionUrl: '/student/results',
      resource: { type: 'examination', id: input.examId },
      data: details({ label: 'Course', value: input.courseTitle }),
      dedupeKey: `result.exam_published:${input.examId}`,
      email: true,
    };
  },

  quizResultsPublished(input: {
    quizId: string;
    courseTitle: string;
    title: string;
  }): NotificationSpec {
    return {
      type: 'RESULT',
      event: 'result.quiz_published',
      title: `Quiz results published: ${input.title}`,
      message: `Results of the quiz ${quoted(input.title)} (${input.courseTitle}) are now available.`,
      actionUrl: '/student/results',
      resource: { type: 'quiz', id: input.quizId },
      data: details({ label: 'Course', value: input.courseTitle }),
      dedupeKey: `result.quiz_published:${input.quizId}`,
      email: true,
    };
  },
};
