import type {
  AdminCertificateListItem,
  CertificateDto,
  CertificateEligibilityResult,
  CertificateIneligibilityReason,
  Paginated,
  PublicCertificateVerificationDto,
} from '@asra/types';
import type { AdminCertificateQuery, PaginationQuery } from '@asra/validation';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import type { DbClient } from '../../database/types.js';
import type { Certificate, Prisma } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../types/auth.js';
import { AppError } from '../../utils/app-error.js';
import { pageArgs, paginated } from '../../utils/pagination.js';
import { adminAudit } from '../admin/audit.js';
import { dispatchAfterCommit } from '../notifications/dispatcher.js';
import { notifyUsers } from '../notifications/notifications.service.js';
import { calculateCourseProgress, isCourseComplete } from '../student/progress.js';
import { toCourseView } from '../student/student.mappers.js';
import { createStudentRepository } from '../student/student.repository.js';
import { generateCertificateNumber } from './id-generator.js';
import { generateCertificatePdf as renderPdf } from './pdf.service.js';

function toCertificateDto(cert: Certificate): CertificateDto {
  return {
    id: cert.id,
    certificateNumber: cert.certificateNumber,
    enrollmentId: cert.enrollmentId,
    userId: cert.userId,
    courseId: cert.courseId,
    recipientName: cert.recipientName,
    courseTitle: cert.courseTitle,
    completedAt: cert.completedAt.toISOString(),
    issuedAt: cert.issuedAt.toISOString(),
    status: cert.status,
    revokedAt: cert.revokedAt ? cert.revokedAt.toISOString() : null,
    revokedReason: cert.revokedReason,
    metadata: (cert.metadata as Record<string, unknown>) ?? null,
    verificationUrl: `${env.NEXT_PUBLIC_APP_URL}/verify/${cert.certificateNumber}`,
    downloadUrl: `/api/v1/student/certificates/${cert.id}/download`,
  };
}

export const certificatesService = {
  /**
   * Evaluates eligibility for a certificate.
   * Pure inspection: does not create records or alter state.
   */
  async checkEligibility(
    auth: AuthContext,
    courseId: string,
    db: DbClient = prisma,
  ): Promise<CertificateEligibilityResult> {
    const [course, enrollment] = await Promise.all([
      db.course.findUnique({
        where: { id: courseId },
        select: { id: true, title: true, status: true },
      }),
      db.enrollment.findUnique({
        where: { userId_courseId: { userId: auth.userId, courseId } },
        include: { certificate: true },
      }),
    ]);

    if (!course) {
      throw new AppError('NOT_FOUND', 'Course not found');
    }

    const reasons: CertificateIneligibilityReason[] = [];

    if (!enrollment) {
      return {
        state: 'INELIGIBLE',
        eligible: false,
        courseId: course.id,
        courseTitle: course.title,
        enrollmentId: null,
        completedAt: null,
        certificate: null,
        reasons: [
          {
            code: 'NOT_ENROLLED',
            message: 'You are not enrolled in this course.',
          },
        ],
        progress: null,
      };
    }

    // If a certificate has already been issued, return state ALREADY_ISSUED
    if (enrollment.certificate) {
      return {
        state: 'ALREADY_ISSUED',
        eligible: true,
        courseId: course.id,
        courseTitle: course.title,
        enrollmentId: enrollment.id,
        completedAt: enrollment.completedAt?.toISOString() ?? null,
        certificate: toCertificateDto(enrollment.certificate),
        reasons: [],
        progress: null,
      };
    }

    if (enrollment.status !== 'ACTIVE') {
      reasons.push({
        code: 'ENROLLMENT_INACTIVE',
        message: 'Your enrollment in this course is not active.',
      });
    }

    // Check course progress
    const studentRepo = createStudentRepository(db);
    const structures = await studentRepo.structures([courseId]);
    const structure = structures.get(courseId);
    const view = toCourseView(structure);
    const progressRows = await studentRepo.progress.forLessons(
      auth.userId,
      view.lessons.map((l) => l.id),
    );
    const completedLessonIds = new Set<string>(
      progressRows.filter((r) => r.completedAt !== null).map((r) => r.lessonId),
    );
    const progress = calculateCourseProgress(
      view.eligibleIds,
      completedLessonIds,
      enrollment.completedAt,
    );

    const isComplete = enrollment.completedAt !== null || isCourseComplete(progress);
    if (!isComplete) {
      reasons.push({
        code: 'PROGRESS_INCOMPLETE',
        message: `Course progress is incomplete (${progress.completedLessons} of ${progress.totalLessons} lessons completed).`,
      });
    }

    // Check assessments/examinations if any published exams exist for this course
    const publishedExams = await db.examination.findMany({
      where: { courseId, status: 'PUBLISHED' },
      select: { id: true, title: true, passPercent: true },
    });

    if (publishedExams.length > 0) {
      for (const exam of publishedExams) {
        const attempts = await db.assessmentAttempt.findMany({
          where: { examinationId: exam.id, userId: auth.userId },
          select: { status: true, evaluationStatus: true, passed: true },
        });

        const pendingAttempt = attempts.find(
          (a) => a.status === 'SUBMITTED' && a.evaluationStatus === 'PENDING',
        );

        if (pendingAttempt) {
          reasons.push({
            code: 'EXAM_PENDING_GRADING',
            message: `Your examination "${exam.title}" is currently pending evaluation.`,
          });
        } else {
          const hasPassed = attempts.some((a) => a.passed === true);
          if (!hasPassed) {
            reasons.push({
              code: 'EXAM_NOT_PASSED',
              message: `You must pass the examination "${exam.title}" (Passing score: ${exam.passPercent}%).`,
            });
          }
        }
      }
    }

    const eligible = reasons.length === 0;

    return {
      state: eligible ? 'ELIGIBLE' : 'INELIGIBLE',
      eligible,
      courseId: course.id,
      courseTitle: course.title,
      enrollmentId: enrollment.id,
      completedAt: enrollment.completedAt?.toISOString() ?? null,
      certificate: null,
      reasons,
      progress,
    };
  },

  /**
   * Idempotently issues a certificate for a qualifying enrollment.
   * If already issued, returns the existing certificate safely without error or duplicates.
   */
  async issueCertificate(
    auth: AuthContext,
    courseId: string,
    adminActorId?: string,
  ): Promise<CertificateDto> {
    return prisma.$transaction(async (tx) => {
      // 0. Serialise issuance per enrolment (double clicks, two tabs). A unique violation would
      //    abort this PostgreSQL transaction, so a concurrent duplicate cannot be recovered from
      //    after the fact; instead the second request waits here and then sees the first
      //    request's committed certificate (READ COMMITTED re-reads per statement).
      await tx.$queryRaw`SELECT "id" FROM "enrollments" WHERE "user_id" = ${auth.userId}::uuid AND "course_id" = ${courseId}::uuid FOR UPDATE`;

      // 1. Verify eligibility inside transaction
      const eligibility = await certificatesService.checkEligibility(auth, courseId, tx);

      if (eligibility.state === 'ALREADY_ISSUED' && eligibility.certificate) {
        return eligibility.certificate;
      }

      if (!eligibility.eligible || !eligibility.enrollmentId) {
        const firstReason = eligibility.reasons[0]?.message ?? 'Not eligible for certificate';
        throw new AppError('BAD_REQUEST', firstReason);
      }

      // 2. Fetch student and course details for snapshots
      const [student, enrollment] = await Promise.all([
        tx.user.findUniqueOrThrow({
          where: { id: auth.userId },
          select: { id: true, fullName: true, email: true },
        }),
        tx.enrollment.findUniqueOrThrow({
          where: { id: eligibility.enrollmentId },
          include: { course: true },
        }),
      ]);

      const now = new Date();
      // If enrollment completedAt was not yet set, record it now
      let completedAt = enrollment.completedAt;
      if (!completedAt) {
        completedAt = now;
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: { completedAt: now },
        });
      }

      // 3. Allocate an unused certificate number. Checked BEFORE inserting: a unique violation
      //    would abort the transaction (see step 0). With ~6.6 × 10^11 numbers per year a
      //    collision is already improbable; a concurrent identical draw is left to the constraint.
      const currentYear = now.getUTCFullYear();
      let certNumber = '';
      for (let attempt = 0; attempt < 5 && !certNumber; attempt++) {
        const candidate = generateCertificateNumber(currentYear);
        const taken = await tx.certificate.findUnique({
          where: { certificateNumber: candidate },
          select: { id: true },
        });
        if (!taken) certNumber = candidate;
      }
      if (!certNumber) {
        throw new AppError('INTERNAL_ERROR', 'Failed to allocate unique certificate number');
      }

      const createdCert = await tx.certificate.create({
        data: {
          certificateNumber: certNumber,
          enrollmentId: enrollment.id,
          userId: auth.userId,
          courseId: enrollment.courseId,
          recipientName: student.fullName,
          courseTitle: enrollment.course.title,
          completedAt,
          issuedAt: now,
          status: 'ISSUED',
          issuedById: adminActorId ?? null,
        },
      });

      // 4. In-app and email notification
      const deliveryIds = await notifyUsers(tx, [auth.userId], {
        type: 'CERTIFICATE',
        event: 'certificate.issued',
        title: 'Certificate Issued!',
        message: `Congratulations! Your certificate for "${enrollment.course.title}" has been issued.`,
        actionUrl: '/student/certificates',
        resource: { type: 'certificate', id: createdCert.id },
        dedupeKey: `certificate:${createdCert.id}`,
        email: true,
        data: {
          certificateNumber: createdCert.certificateNumber,
          courseTitle: createdCert.courseTitle,
          recipientName: createdCert.recipientName,
        },
      });

      // 5. Admin audit log if issued via administrative flow
      if (adminActorId) {
        await adminAudit(tx, {
          action: 'certificate.issued_by_admin',
          actorId: adminActorId,
          entityType: 'certificate',
          entityId: createdCert.id,
          data: {
            certificateNumber: createdCert.certificateNumber,
            courseTitle: createdCert.courseTitle,
            studentId: auth.userId,
          },
        });
      }

      dispatchAfterCommit(deliveryIds);
      return toCertificateDto(createdCert);
    });
  },

  /**
   * Retrieves all certificates earned by the authenticated student.
   */
  async getStudentCertificates(
    auth: AuthContext,
    query: PaginationQuery,
  ): Promise<Paginated<CertificateDto>> {
    const { skip, take } = pageArgs(query);
    const where: Prisma.CertificateWhereInput = {
      userId: auth.userId,
    };

    const [rows, total] = await Promise.all([
      prisma.certificate.findMany({
        where,
        skip,
        take,
        orderBy: { issuedAt: 'desc' },
      }),
      prisma.certificate.count({ where }),
    ]);

    return paginated(rows.map(toCertificateDto), total, query);
  },

  /**
   * Retrieves a single student certificate by internal ID.
   * Ensures the student owns the certificate.
   */
  async getStudentCertificateById(auth: AuthContext, id: string): Promise<CertificateDto> {
    const cert = await prisma.certificate.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!cert) {
      throw new AppError('NOT_FOUND', 'Certificate not found');
    }

    return toCertificateDto(cert);
  },

  /**
   * Public verification endpoint.
   * Privacy-safe: never returns student email, internal IDs, or private data.
   */
  async verifyPublicCertificate(
    certificateNumber: string,
  ): Promise<PublicCertificateVerificationDto> {
    const cert = await prisma.certificate.findUnique({
      where: { certificateNumber },
    });

    if (!cert) {
      throw new AppError('NOT_FOUND', 'Certificate not found with this identifier');
    }

    return {
      valid: cert.status === 'ISSUED',
      certificateNumber: cert.certificateNumber,
      status: cert.status,
      recipientName: cert.recipientName,
      courseTitle: cert.courseTitle,
      academyName: 'ASRA Academy',
      completedAt: cert.completedAt.toISOString(),
      issuedAt: cert.issuedAt.toISOString(),
      revokedAt: cert.revokedAt ? cert.revokedAt.toISOString() : null,
      revokedReason: cert.revokedReason,
    };
  },

  /**
   * Generates a downloadable PDF buffer for a certificate.
   * Authorizes that the requestor is the recipient student or an authorized administrator.
   */
  async getCertificatePdf(
    certificateId: string,
    auth?: AuthContext,
  ): Promise<{ buffer: Buffer; filename: string; certificate: CertificateDto }> {
    const cert = await prisma.certificate.findUnique({
      where: { id: certificateId },
    });

    if (!cert) {
      throw new AppError('NOT_FOUND', 'Certificate not found');
    }

    // Authorization check if user context is provided
    if (auth) {
      const isOwner = cert.userId === auth.userId;
      const isAdmin = auth.roles.has('ADMIN') || auth.roles.has('SUPER_ADMIN');
      if (!isOwner && !isAdmin) {
        throw new AppError('FORBIDDEN', 'You do not have permission to download this certificate');
      }
    }

    const verificationUrl = `${env.NEXT_PUBLIC_APP_URL}/verify/${cert.certificateNumber}`;

    const buffer = await renderPdf({
      certificateNumber: cert.certificateNumber,
      recipientName: cert.recipientName,
      courseTitle: cert.courseTitle,
      completedAt: cert.completedAt,
      issuedAt: cert.issuedAt,
      verificationUrl,
    });

    const safeFilename = `ASRA-Certificate-${cert.certificateNumber}.pdf`;

    return {
      buffer,
      filename: safeFilename,
      certificate: toCertificateDto(cert),
    };
  },

  /**
   * Admin: List certificates with filtering, searching, and pagination.
   */
  async listAdminCertificates(
    query: AdminCertificateQuery,
  ): Promise<Paginated<AdminCertificateListItem>> {
    const { skip, take } = pageArgs(query);

    const where: Prisma.CertificateWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.courseId) {
      where.courseId = query.courseId;
    }
    if (query.studentId) {
      where.userId = query.studentId;
    }

    if (query.search) {
      where.OR = [
        { certificateNumber: { contains: query.search, mode: 'insensitive' } },
        { recipientName: { contains: query.search, mode: 'insensitive' } },
        { courseTitle: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.certificate.findMany({
        where,
        skip,
        take,
        orderBy: { issuedAt: 'desc' },
        include: {
          user: { select: { email: true } },
          issuedBy: { select: { fullName: true } },
        },
      }),
      prisma.certificate.count({ where }),
    ]);

    const items: AdminCertificateListItem[] = rows.map((r) => ({
      id: r.id,
      certificateNumber: r.certificateNumber,
      enrollmentId: r.enrollmentId,
      userId: r.userId,
      recipientName: r.recipientName,
      studentEmail: r.user.email,
      courseId: r.courseId,
      courseTitle: r.courseTitle,
      completedAt: r.completedAt.toISOString(),
      issuedAt: r.issuedAt.toISOString(),
      status: r.status,
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
      revokedReason: r.revokedReason,
      issuedByName: r.issuedBy?.fullName ?? null,
    }));

    return paginated(items, total, query);
  },

  /**
   * Admin: Get certificate detail by ID.
   */
  async getAdminCertificateById(id: string): Promise<AdminCertificateListItem> {
    const cert = await prisma.certificate.findUnique({
      where: { id },
      include: {
        user: { select: { email: true } },
        issuedBy: { select: { fullName: true } },
      },
    });

    if (!cert) {
      throw new AppError('NOT_FOUND', 'Certificate not found');
    }

    return {
      id: cert.id,
      certificateNumber: cert.certificateNumber,
      enrollmentId: cert.enrollmentId,
      userId: cert.userId,
      recipientName: cert.recipientName,
      studentEmail: cert.user.email,
      courseId: cert.courseId,
      courseTitle: cert.courseTitle,
      completedAt: cert.completedAt.toISOString(),
      issuedAt: cert.issuedAt.toISOString(),
      status: cert.status,
      revokedAt: cert.revokedAt ? cert.revokedAt.toISOString() : null,
      revokedReason: cert.revokedReason,
      issuedByName: cert.issuedBy?.fullName ?? null,
    };
  },

  /**
   * Admin: Revoke an issued certificate with mandatory reason.
   */
  async revokeCertificate(auth: AuthContext, id: string, reason: string): Promise<CertificateDto> {
    return prisma.$transaction(async (tx) => {
      const cert = await tx.certificate.findUnique({
        where: { id },
      });

      if (!cert) {
        throw new AppError('NOT_FOUND', 'Certificate not found');
      }

      if (cert.status === 'REVOKED') {
        throw new AppError('BAD_REQUEST', 'Certificate is already revoked');
      }

      const now = new Date();
      const updated = await tx.certificate.update({
        where: { id },
        data: {
          status: 'REVOKED',
          revokedAt: now,
          revokedReason: reason,
        },
      });

      await adminAudit(tx, {
        action: 'certificate.revoked_by_admin',
        actorId: auth.userId,
        entityType: 'certificate',
        entityId: id,
        data: {
          certificateNumber: cert.certificateNumber,
          reason,
        },
      });

      return toCertificateDto(updated);
    });
  },
};
