import type { CourseProgressDto } from './student.js';

export type CertificateStatus = 'ISSUED' | 'REVOKED';

export interface CertificateDto {
  id: string;
  certificateNumber: string;
  enrollmentId: string;
  userId: string;
  courseId: string;
  recipientName: string;
  courseTitle: string;
  completedAt: string;
  issuedAt: string;
  status: CertificateStatus;
  revokedAt?: string | null;
  revokedReason?: string | null;
  metadata?: Record<string, unknown> | null;
  verificationUrl: string;
  downloadUrl: string;
}

export type CertificateEligibilityState = 'ELIGIBLE' | 'ALREADY_ISSUED' | 'INELIGIBLE';

export type CertificateIneligibilityCode =
  | 'NOT_ENROLLED'
  | 'ENROLLMENT_INACTIVE'
  | 'PROGRESS_INCOMPLETE'
  | 'EXAM_NOT_PASSED'
  | 'EXAM_PENDING_GRADING'
  | 'COURSE_NOT_COMPLETED';

export interface CertificateIneligibilityReason {
  code: CertificateIneligibilityCode;
  message: string;
}

export interface CertificateEligibilityResult {
  state: CertificateEligibilityState;
  eligible: boolean;
  courseId: string;
  courseTitle: string;
  enrollmentId?: string | null;
  completedAt?: string | null;
  certificate?: CertificateDto | null;
  reasons: CertificateIneligibilityReason[];
  progress?: CourseProgressDto | null;
}

export interface PublicCertificateVerificationDto {
  valid: boolean;
  certificateNumber: string;
  status: CertificateStatus;
  recipientName: string;
  courseTitle: string;
  academyName: string;
  completedAt: string;
  issuedAt: string;
  revokedAt?: string | null;
  revokedReason?: string | null;
}

export interface AdminCertificateListItem {
  id: string;
  certificateNumber: string;
  enrollmentId: string;
  userId: string;
  recipientName: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  completedAt: string;
  issuedAt: string;
  status: CertificateStatus;
  revokedAt?: string | null;
  revokedReason?: string | null;
  issuedByName?: string | null;
}
