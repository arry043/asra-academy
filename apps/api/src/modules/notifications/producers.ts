import type { DbClient } from '../../database/types.js';
import { formatAmount } from '../../email/email.service.js';
import { assessmentEvents, enrollmentEvents, paymentEvents, registrationEvents } from './events.js';
import { eligibleStudentIds, notifyUsers } from './notifications.service.js';

/**
 * Hooks called by business modules INSIDE the transaction that makes an event true (PHASE 11,
 * docs/NOTIFICATIONS.md §3). Each loads what it needs from that transaction, decides the
 * recipients from the database (never from the request) and returns the EMAIL delivery ids to
 * pass to `dispatchAfterCommit` once the transaction has committed. All are idempotent.
 */
export const notificationProducers = {
  /** Email verified → welcome (students only; staff accounts are provisioned by admins). */
  async welcome(tx: DbClient, userId: string): Promise<string[]> {
    const student = await tx.userRole.findFirst({
      where: { userId, role: { key: 'STUDENT' } },
      select: { userId: true },
    });
    return student ? notifyUsers(tx, [userId], registrationEvents.welcome()) : [];
  },

  /**
   * A FREE or ADMIN enrolment became ACTIVE. Only for a PUBLISHED course: an enrolment in an
   * unpublished course grants nothing yet, so "the course is open" would not be true.
   * PAYMENT enrolments are covered by `paymentReceived` (one message per purchase).
   */
  async enrollmentActivated(tx: DbClient, enrollmentId: string): Promise<string[]> {
    const row = await tx.enrollment.findUnique({
      where: { id: enrollmentId },
      select: {
        id: true,
        userId: true,
        status: true,
        source: true,
        enrolledAt: true,
        course: { select: { id: true, title: true, status: true } },
      },
    });
    if (!row || row.status !== 'ACTIVE' || row.course.status !== 'PUBLISHED') return [];
    if (row.source !== 'FREE' && row.source !== 'ADMIN') return [];
    return notifyUsers(
      tx,
      [row.userId],
      enrollmentEvents.activated({
        enrollmentId: row.id,
        enrolledAt: row.enrolledAt,
        courseId: row.course.id,
        courseTitle: row.course.title,
        source: row.source,
      }),
    );
  },

  /** The order was just marked PAID from verified provider data. In-app only. */
  async paymentReceived(tx: DbClient, orderId: string): Promise<void> {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { id: true, userId: true, courseTitle: true, amountMinor: true, currency: true },
    });
    await notifyUsers(
      tx,
      [order.userId],
      paymentEvents.received({
        orderId: order.id,
        courseTitle: order.courseTitle,
        amount: formatAmount(order.amountMinor, order.currency),
      }),
    );
  },

  /** A refund was just recorded as PROCESSED by the provider. In-app only. */
  async refundProcessed(tx: DbClient, refundId: string): Promise<void> {
    const refund = await tx.refund.findUniqueOrThrow({
      where: { id: refundId },
      select: {
        id: true,
        amountMinor: true,
        currency: true,
        payment: { select: { userId: true, order: { select: { courseTitle: true } } } },
      },
    });
    await notifyUsers(
      tx,
      [refund.payment.userId],
      paymentEvents.refundProcessed({
        refundId: refund.id,
        courseTitle: refund.payment.order.courseTitle,
        amount: formatAmount(refund.amountMinor, refund.currency),
      }),
    );
  },

  /**
   * An ASSIGNMENT lesson is PUBLISHED in a PUBLISHED course. Called whenever a lesson may have
   * just become a published assignment; it re-checks and the dedupe key makes it once per lesson.
   */
  async assignmentPublished(tx: DbClient, lessonId: string): Promise<string[]> {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        title: true,
        status: true,
        contentType: true,
        assignment: { select: { dueAt: true } },
        chapter: {
          select: {
            module: { select: { course: { select: { id: true, title: true, status: true } } } },
          },
        },
      },
    });
    const course = lesson?.chapter.module.course;
    if (!lesson || !course || lesson.contentType !== 'ASSIGNMENT') return [];
    if (lesson.status !== 'PUBLISHED' || course.status !== 'PUBLISHED') return [];
    const students = await eligibleStudentIds(tx, course.id);
    return notifyUsers(
      tx,
      students,
      assessmentEvents.assignmentPublished({
        lessonId: lesson.id,
        courseId: course.id,
        courseTitle: course.title,
        title: lesson.title,
        dueAt: lesson.assignment?.dueAt ?? null,
      }),
    );
  },

  /** A graded submission's result was released to its student. */
  async assignmentResultReleased(tx: DbClient, submissionId: string): Promise<string[]> {
    const row = await tx.assignmentSubmission.findUniqueOrThrow({
      where: { id: submissionId },
      select: {
        id: true,
        userId: true,
        assignment: {
          select: {
            lesson: {
              select: {
                title: true,
                chapter: {
                  select: { module: { select: { course: { select: { title: true } } } } },
                },
              },
            },
          },
        },
      },
    });
    const { lesson } = row.assignment;
    return notifyUsers(
      tx,
      [row.userId],
      assessmentEvents.assignmentResultReleased({
        submissionId: row.id,
        courseTitle: lesson.chapter.module.course.title,
        title: lesson.title,
      }),
    );
  },

  /** An examination was published; students who can access its (published) course hear of it. */
  async examPublished(tx: DbClient, examId: string): Promise<string[]> {
    const exam = await tx.examination.findUniqueOrThrow({
      where: { id: examId },
      select: {
        id: true,
        title: true,
        status: true,
        opensAt: true,
        closesAt: true,
        durationMinutes: true,
        course: { select: { id: true, title: true, status: true } },
      },
    });
    if (exam.status !== 'PUBLISHED' || exam.course.status !== 'PUBLISHED') return [];
    return notifyUsers(
      tx,
      await eligibleStudentIds(tx, exam.course.id),
      assessmentEvents.examPublished({
        examId: exam.id,
        courseTitle: exam.course.title,
        title: exam.title,
        opensAt: exam.opensAt,
        closesAt: exam.closesAt,
        durationMinutes: exam.durationMinutes,
      }),
    );
  },

  /** Exam results released: students who attempted it and can still access the course. */
  async examResultsPublished(tx: DbClient, examId: string): Promise<string[]> {
    const exam = await tx.examination.findUniqueOrThrow({
      where: { id: examId },
      select: { id: true, title: true, course: { select: { id: true, title: true } } },
    });
    const attempted = await tx.assessmentAttempt.findMany({
      where: { examinationId: examId },
      distinct: ['userId'],
      select: { userId: true },
    });
    const eligible = new Set(await eligibleStudentIds(tx, exam.course.id));
    return notifyUsers(
      tx,
      attempted.map((row) => row.userId).filter((id) => eligible.has(id)),
      assessmentEvents.examResultsPublished({
        examId: exam.id,
        courseTitle: exam.course.title,
        title: exam.title,
      }),
    );
  },

  /** Quiz results released by faculty (quizzes that do not show results immediately). */
  async quizResultsPublished(tx: DbClient, quizId: string): Promise<string[]> {
    const quiz = await tx.quiz.findUniqueOrThrow({
      where: { id: quizId },
      select: {
        id: true,
        lesson: {
          select: {
            title: true,
            chapter: {
              select: { module: { select: { course: { select: { id: true, title: true } } } } },
            },
          },
        },
      },
    });
    const course = quiz.lesson.chapter.module.course;
    const attempted = await tx.assessmentAttempt.findMany({
      where: { quizId },
      distinct: ['userId'],
      select: { userId: true },
    });
    const eligible = new Set(await eligibleStudentIds(tx, course.id));
    return notifyUsers(
      tx,
      attempted.map((row) => row.userId).filter((id) => eligible.has(id)),
      assessmentEvents.quizResultsPublished({
        quizId: quiz.id,
        courseTitle: course.title,
        title: quiz.lesson.title,
      }),
    );
  },
};
