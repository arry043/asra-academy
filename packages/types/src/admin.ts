import type { AssessmentStatus } from './assessment.js';
import type { PublicationStatus } from './catalog.js';
import type { NotificationType } from './notifications.js';
import type {
  AdminOrderListItem,
  CurrencyTotalsDto,
  PaymentMode,
  PaymentStatus,
} from './payments.js';
import type { CourseProgressDto, EnrollmentSource, EnrollmentStatus } from './student.js';

/**
 * Response shapes of the PHASE 12 administration endpoints (docs/ADMIN-DASHBOARD.md):
 * dashboard, analytics, user directory, roles, audit logs and operational lists.
 *
 * Every figure is computed by the API from persisted rows; the definitions are documented next to
 * each field and in docs/ADMIN-DASHBOARD.md §3–4. A section the signed-in administrator may not
 * see is `null` — the server omits it, the UI does not merely hide it.
 */

/** Calendar days and buckets of analytics are interpreted in this zone (V-09: IST). */
export const ANALYTICS_TIME_ZONE = 'Asia/Kolkata';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type AnalyticsGranularity = 'day' | 'week' | 'month';

// --- Dashboard ------------------------------------------------------------------------------

/** Count in a window and in the window of the same length just before it. */
export interface PeriodComparison {
  /** Window length in days, ending now. */
  days: number;
  current: number;
  previous: number;
}

export interface DashboardKpis {
  students: {
    /** Accounts holding the STUDENT role, any status. */
    total: number;
    /** …of which ACTIVE. */
    active: number;
    /** Student accounts created (users.created_at) in the last 30 days vs the 30 before. */
    registrations: PeriodComparison;
  } | null;
  faculty: { total: number; active: number } | null;
  courses: {
    total: number;
    published: number;
    draft: number;
    archived: number;
  } | null;
  enrollments: {
    /** Enrolment rows (one per student and course), any status. */
    total: number;
    /** Currently granting access (status ACTIVE). */
    active: number;
    /** Enrolments whose latest activation (enrolled_at) falls in the window. */
    newEnrollments: PeriodComparison;
  } | null;
  /** Requires `payments.view`. One payment mode only (the active mode, else LIVE). */
  revenue: {
    mode: PaymentMode;
    /** All-time totals per currency (gross captured, processed refunds, net). */
    totals: CurrencyTotalsDto[];
    /** Net collected (captured − processed refunds) by instant, last 30 days vs the 30 before. */
    last30Days: { currency: string; currentNetMinor: number; previousNetMinor: number }[];
  } | null;
  liveClasses: {
    /** SCHEDULED classes that have not ended yet. */
    upcoming: number;
    /** …of which starting in the next 7 days. */
    next7Days: number;
  } | null;
  pendingWork: {
    /** Assignment submissions with status SUBMITTED (waiting for a grade). */
    submissionsAwaitingReview: number;
    /** Finalized quiz/exam attempts whose written answers still need manual grading. */
    attemptsAwaitingGrading: number;
  } | null;
  examinations: {
    /** PUBLISHED examinations whose window has not opened yet. */
    upcoming: number;
    /** PUBLISHED examinations whose window is open now. */
    open: number;
    /** PUBLISHED or CLOSED examinations whose window ended and results are not published. */
    awaitingResults: number;
  } | null;
}

export interface DashboardStudentRow {
  userId: string;
  fullName: string;
  email: string;
  status: UserStatus;
  createdAt: string;
}

export interface DashboardLiveClassRow {
  id: string;
  title: string;
  course: { id: string; title: string };
  host: string | null;
  startsAt: string;
  durationMinutes: number;
  timeZone: string;
  hasJoinLink: boolean;
  meetingLastError: string | null;
}

export interface DashboardPendingReviewRow {
  submissionId: string;
  assignmentTitle: string;
  course: { id: string; title: string };
  submittedAt: string;
  late: boolean;
}

export interface DashboardExamRow {
  id: string;
  title: string;
  course: { id: string; title: string };
  opensAt: string;
  closesAt: string;
}

export interface AdminAuditEntryDto {
  id: string;
  source: AuditSource;
  action: string;
  actor: { userId: string; fullName: string } | null;
  entityType: string;
  entityId: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}

/** Operational problems that need someone to act. Each count links to the filtered list. */
export interface DashboardAttention {
  /** Requires `notifications.view`. Email deliveries that FAILED permanently. */
  failedEmails: number | null;
  /** Requires `payments.view`. Captured payments flagged for an administrator. */
  paymentsNeedingReview: number | null;
  /** Requires `payments.view`. Payment attempts that FAILED in the last 7 days. */
  failedPaymentsLast7Days: number | null;
  /** Requires `live_classes.manage`. Upcoming classes whose Google Meet link could not be created. */
  liveClassesWithMeetingErrors: number | null;
}

/** `GET /admin/dashboard` */
export interface AdminDashboardDto {
  generatedAt: string;
  timeZone: string;
  kpis: DashboardKpis;
  attention: DashboardAttention;
  recentStudents: DashboardStudentRow[] | null;
  recentOrders: AdminOrderListItem[] | null;
  upcomingLiveClasses: DashboardLiveClassRow[] | null;
  pendingReviews: DashboardPendingReviewRow[] | null;
  upcomingExams: DashboardExamRow[] | null;
  recentActivity: AdminAuditEntryDto[] | null;
}

// --- Analytics ------------------------------------------------------------------------------

/** The resolved filter every analytics response echoes back. */
export interface AnalyticsRange {
  /** Inclusive calendar days in `timeZone`. */
  from: string;
  to: string;
  granularity: AnalyticsGranularity;
  timeZone: string;
  /** The window of the same length immediately before `from`. */
  previousFrom: string;
  previousTo: string;
}

/** One time bucket. `period` is the first day of the bucket (may start before `range.from`). */
export interface SeriesPoint {
  period: string;
  value: number;
}

/** `GET /admin/analytics/student-growth` */
export interface StudentGrowthDto {
  range: AnalyticsRange;
  series: SeriesPoint[];
  /** Student accounts created in the range. */
  total: number;
  /** …in the previous window. */
  previousTotal: number;
  /** All student accounts that exist now. */
  allTime: number;
}

export interface EnrollmentBreakdownRow {
  id: string | null;
  label: string;
  /** Enrolments whose latest activation is in the range. */
  newEnrollments: number;
  /** Of those, still ACTIVE now. */
  stillActive: number;
}

/** `GET /admin/analytics/enrollments` */
export interface EnrollmentAnalyticsDto {
  range: AnalyticsRange;
  series: SeriesPoint[];
  total: number;
  previousTotal: number;
  /** All enrolments ACTIVE right now (not limited to the range). */
  activeNow: number;
  bySource: { source: EnrollmentSource; count: number }[];
  byCourse: EnrollmentBreakdownRow[];
  byClass: EnrollmentBreakdownRow[];
  bySubject: EnrollmentBreakdownRow[];
}

export interface PopularCourseRow {
  rank: number;
  course: { id: string; title: string; status: PublicationStatus };
  /** Ranking key: enrolments whose latest activation is in the range. */
  newEnrollments: number;
  /** ACTIVE enrolments now (all time). */
  activeEnrollments: number;
  /** All enrolment rows, any status (all time). */
  totalEnrollments: number;
  /** ACTIVE enrolments with `completedAt` set (all time). */
  completedEnrollments: number;
  /** completed ÷ active × 100, floored; null when there are no active enrolments. */
  completionPercent: number | null;
}

export interface PaginatedAnalytics<TItem> {
  range: AnalyticsRange;
  items: TItem[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
}

export interface RevenueSeriesPoint {
  period: string;
  grossMinor: number;
  refundedMinor: number;
  netMinor: number;
}

export interface RevenueByCourseRow {
  course: { id: string; title: string };
  currency: string;
  grossMinor: number;
  refundedMinor: number;
  netMinor: number;
  capturedPayments: number;
}

/** `GET /admin/analytics/revenue` — requires `payments.view` too. ONE mode, per currency. */
export interface RevenueAnalyticsDto {
  range: AnalyticsRange;
  mode: PaymentMode;
  /** Currencies seen in the range; the series below are per currency. */
  currencies: string[];
  totals: CurrencyTotalsDto[];
  previousTotals: CurrencyTotalsDto[];
  series: { currency: string; points: RevenueSeriesPoint[] }[];
  byCourse: RevenueByCourseRow[];
  /** Payment attempts CREATED in the range, by their current status. */
  paymentStatus: { status: PaymentStatus; count: number }[];
  /** Payment attempts that FAILED in the range. */
  failedPayments: number;
  /** Orders still CREATED/PENDING that were created in the range. */
  pendingOrders: number;
}

export interface CompletionCourseRow {
  course: { id: string; title: string; status: PublicationStatus };
  /** Denominator: ACTIVE enrolments (in the cohort). */
  eligible: number;
  /** Numerator: those with `completedAt` set. */
  completed: number;
  completionPercent: number | null;
}

/**
 * `GET /admin/analytics/completion` — all ACTIVE enrolments, or (when `from`/`to` are given) the
 * cohort of enrolments activated in that range; `range` is null for "all time".
 */
export interface CompletionAnalyticsDto {
  range: AnalyticsRange | null;
  overall: { eligible: number; completed: number; completionPercent: number | null };
  items: CompletionCourseRow[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
}

export interface ScoreBucket {
  /** Lower bound in percent (0, 10, … 90); the 90 bucket includes 100. */
  from: number;
  to: number;
  count: number;
}

export interface ExamPerformanceRow {
  exam: { id: string; title: string; status: AssessmentStatus };
  course: { id: string; title: string };
  opensAt: string;
  closesAt: string;
  resultsPublishedAt: string | null;
  /** Attempts SUBMITTED or EXPIRED (finalized), in the range when one is given. */
  finalizedAttempts: number;
  /** …of which fully evaluated (score known). */
  evaluatedAttempts: number;
  /** …of which still waiting for manual grading. */
  pendingEvaluation: number;
  /** Mean percent over EVALUATED attempts only; null without any. */
  averagePercent: number | null;
  passedAttempts: number;
  /** passed ÷ evaluated × 100, floored; null without evaluated attempts. */
  passPercent: number | null;
}

/**
 * `GET /admin/analytics/exams` — every finalized attempt, or (when `from`/`to` are given) those
 * submitted in that range; `range` is null for "all time". DRAFT examinations are excluded.
 */
export interface ExamAnalyticsDto {
  range: AnalyticsRange | null;
  overall: {
    finalizedAttempts: number;
    evaluatedAttempts: number;
    pendingEvaluation: number;
    averagePercent: number | null;
    passedAttempts: number;
    passPercent: number | null;
    distinctStudents: number;
  };
  distribution: ScoreBucket[];
  items: ExamPerformanceRow[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
}

export interface FacultyPerformanceRow {
  faculty: { facultyProfileId: string; userId: string; fullName: string; status: UserStatus };
  /** Courses the faculty member is assigned to now. */
  assignedCourses: number;
  /** Distinct students with an ACTIVE enrolment in those courses now. */
  activeStudents: number;
  /** Classes hosted with status COMPLETED that started in the range. */
  liveClassesCompleted: number;
  /** Classes hosted that were CANCELLED and were due to start in the range. */
  liveClassesCancelled: number;
  /** Submissions this faculty member graded (graded_at) in the range. */
  submissionsGraded: number;
  /** Median hours from (current version) submission to grade, for those; null without any. */
  medianGradingHours: number | null;
  /** Submissions in the assigned courses still waiting for a grade (now). */
  pendingSubmissions: number;
  /** Finalized attempts in the assigned courses waiting for manual grading (now). */
  pendingAttemptGrading: number;
  /** ACTIVE enrolments in assigned courses with `completedAt` set ÷ ACTIVE enrolments (now). */
  completionPercent: number | null;
}

// --- User directory -------------------------------------------------------------------------

export type DirectoryRole = 'STUDENT' | 'FACULTY' | 'ADMIN';

export interface AdminUserListItem {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  emailVerified: boolean;
  roles: string[];
  createdAt: string;
  /** Students: class name (if any) and enrolment counts. */
  student: { className: string | null; activeEnrollments: number; totalEnrollments: number } | null;
  /** Faculty: designation and number of course assignments. */
  faculty: { designation: string | null; assignedCourses: number } | null;
}

export interface AdminUserEnrollmentRow {
  id: string;
  course: { id: string; title: string };
  status: EnrollmentStatus;
  source: EnrollmentSource;
  enrolledAt: string;
  cancelledAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  progress: CourseProgressDto;
}

export interface AdminUserFacultyCourseRow {
  course: { id: string; title: string; status: PublicationStatus };
  isPrimary: boolean;
  assignedAt: string;
  activeStudents: number;
  pendingReviews: number;
  upcomingClasses: number;
}

/** What the signed-in administrator may do with this account (the API re-checks every action). */
export interface AdminUserCapabilities {
  changeStatus: boolean;
  manageRoles: boolean;
  viewPayments: boolean;
  /** Roles the administrator could grant (subset of their own permissions; not already held). */
  grantableRoles: string[];
  /** Roles the administrator could revoke from this user. */
  revocableRoles: string[];
}

/** `GET /admin/users/:id` */
export interface AdminUserDetail extends AdminUserListItem {
  updatedAt: string;
  lastSignInAt: string | null;
  studentProfile: {
    studentCode: string | null;
    class: { id: string; name: string } | null;
    stream: { id: string; name: string } | null;
  } | null;
  facultyProfile: {
    facultyProfileId: string;
    employeeCode: string | null;
    designation: string | null;
    specialization: string | null;
    experienceYears: number | null;
    isPublic: boolean;
  } | null;
  enrollments: AdminUserEnrollmentRow[] | null;
  /** Requires `payments.view`: the student's orders (all modes, newest first, at most 20). */
  orders: AdminOrderListItem[] | null;
  teaching: AdminUserFacultyCourseRow[] | null;
  capabilities: AdminUserCapabilities;
}

// --- Roles & permissions --------------------------------------------------------------------

export interface AdminRoleDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

/** `GET /admin/roles` */
export interface AdminRolesDto {
  roles: AdminRoleDto[];
  permissions: { key: string; description: string | null }[];
}

// --- Audit logs -----------------------------------------------------------------------------

export type AuditSource = 'admin' | 'payment' | 'assessment';

// --- Operational lists ----------------------------------------------------------------------

export interface AdminEnrollmentListItem {
  id: string;
  student: { userId: string; fullName: string; email: string };
  course: { id: string; title: string };
  status: EnrollmentStatus;
  source: EnrollmentSource;
  enrolledAt: string;
  cancelledAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  orderReference: string | null;
}

export type NotificationDeliveryStatus = 'PENDING' | 'SENDING' | 'ACCEPTED' | 'FAILED' | 'SKIPPED';

export interface AdminNotificationDeliveryItem {
  id: string;
  status: NotificationDeliveryStatus;
  channel: 'EMAIL';
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string;
  acceptedAt: string | null;
  createdAt: string;
  notification: { type: NotificationType; event: string; title: string };
  recipient: { userId: string; fullName: string };
}

/** `GET /admin/notifications/deliveries/summary` */
export interface AdminNotificationSummaryDto {
  byStatus: { status: NotificationDeliveryStatus; count: number }[];
  /** In-app notifications created in the last 7 days. */
  inAppLast7Days: number;
}

export interface AdminAssignmentItem {
  assignmentId: string;
  lessonId: string;
  title: string;
  lessonStatus: PublicationStatus;
  course: { id: string; title: string };
  maxMarks: number;
  dueAt: string | null;
  submissions: number;
  awaitingReview: number;
  graded: number;
  released: number;
}

export interface AdminQuizItem {
  quizId: string;
  lessonId: string;
  title: string;
  status: AssessmentStatus;
  course: { id: string; title: string };
  questionCount: number;
  finalizedAttempts: number;
  pendingEvaluation: number;
  resultsPublishedAt: string | null;
}

export interface AdminExamItem {
  examId: string;
  title: string;
  status: AssessmentStatus;
  course: { id: string; title: string };
  opensAt: string;
  closesAt: string;
  questionCount: number;
  finalizedAttempts: number;
  pendingEvaluation: number;
  resultsPublishedAt: string | null;
}
