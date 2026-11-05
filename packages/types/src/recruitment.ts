export type JobStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type JobApplicationStatus =
  | 'RECEIVED'
  | 'UNDER_REVIEW'
  | 'SHORTLISTED'
  | 'ON_HOLD'
  | 'INTERVIEW_SCHEDULED'
  | 'ACCEPTED'
  | 'REJECTED';

export type JobQuestionType =
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'SINGLE_SELECT'
  | 'MULTI_SELECT'
  | 'YES_NO'
  | 'NUMBER'
  | 'DATE'
  | 'URL';

export type InterviewStatus = 'SCHEDULED' | 'RESCHEDULED' | 'COMPLETED' | 'CANCELLED';

export type RecruitmentEmailStatus = 'SENT' | 'FAILED' | 'PENDING';

export interface JobQuestionValidationConfig {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface JobQuestionDto {
  id: string;
  jobId: string;
  label: string;
  helpText?: string | null;
  fieldType: JobQuestionType;
  required: boolean;
  options?: string[] | null;
  displayOrder: number;
  validation?: JobQuestionValidationConfig | null;
}

export interface PublicCareerCategoryDto {
  category: string;
  label: string;
  count: number;
}

export interface PublicJobListItemDto {
  id: string;
  jobId: string;
  title: string;
  slug: string;
  department: string;
  category: string;
  employmentType: string;
  workLocation: string;
  workArrangement: string;
  vacancies?: number | null;
  experienceRequired?: string | null;
  minQualification?: string | null;
  maxQualification?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency: string;
  isSalaryPublic: boolean;
  shortDescription?: string | null;
  openingDate?: string | null;
  closingDate?: string | null;
  allowApplications: boolean;
  isExpired: boolean;
  createdAt: string;
}

export interface PublicJobDetailDto extends PublicJobListItemDto {
  description: string;
  responsibilities?: string | null;
  requiredSkills?: string | null;
  preferredSkills?: string | null;
  requiredQualifications?: string | null;
  additionalRequirements?: string | null;
  benefits?: string | null;
  questions: JobQuestionDto[];
}

export type PublicJobSummary = PublicJobListItemDto;
export type PublicJobDetail = PublicJobDetailDto;

export interface AdminJobListItemDto {
  id: string;
  jobId: string;
  title: string;
  slug: string;
  department: string;
  category: string;
  employmentType: string;
  workLocation: string;
  workArrangement: string;
  vacancies?: number | null;
  status: JobStatus;
  isSalaryPublic: boolean;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency: string;
  openingDate?: string | null;
  closingDate?: string | null;
  allowApplications: boolean;
  isExpired: boolean;
  applicationsCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  archivedAt?: string | null;
}

export interface AdminJobDetailDto extends AdminJobListItemDto {
  shortDescription?: string | null;
  description: string;
  responsibilities?: string | null;
  requiredSkills?: string | null;
  preferredSkills?: string | null;
  requiredQualifications?: string | null;
  additionalRequirements?: string | null;
  benefits?: string | null;
  experienceRequired?: string | null;
  minQualification?: string | null;
  maxQualification?: string | null;
  questions: JobQuestionDto[];
  createdById?: string | null;
  updatedById?: string | null;
}

export interface JobApplicationAnswerDto {
  id: string;
  questionId?: string | null;
  questionLabel: string;
  fieldType: string;
  answerText?: string | null;
  answerJson?: unknown;
}

export interface JobApplicationStatusHistoryDto {
  id: string;
  fromStatus?: JobApplicationStatus | null;
  toStatus: JobApplicationStatus;
  reason?: string | null;
  changedById?: string | null;
  changedBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  createdAt: string;
}

export interface JobApplicationNoteDto {
  id: string;
  note: string;
  adminId: string;
  admin: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface JobInterviewDto {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  timezone: string;
  interviewType: string;
  meetingUrl: string;
  instructions?: string | null;
  notes?: string | null;
  status: InterviewStatus;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdById?: string | null;
  createdBy?: {
    id: string;
    fullName: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobApplicationCommunicationDto {
  id: string;
  recipientEmail: string;
  template: string;
  subject: string;
  messageText: string;
  providerMessageId?: string | null;
  status: RecruitmentEmailStatus;
  error?: string | null;
  sentById?: string | null;
  sentBy?: {
    id: string;
    fullName: string;
  } | null;
  sentAt: string;
}

export interface AdminJobApplicationListItemDto {
  id: string;
  referenceId: string;
  jobId: string;
  jobPublicId: string;
  jobTitle: string;
  department: string;
  category: string;
  fullName: string;
  email: string;
  phone: string;
  currentLocation: string;
  status: JobApplicationStatus;
  createdAt: string;
  updatedAt: string;
  interviewsCount: number;
  hasResume: boolean;
}

export interface AdminJobApplicationDetailDto extends AdminJobApplicationListItemDto {
  resumeAssetId: string;
  resumeOriginalName: string;
  resumeMimeType: string;
  resumeFileSize: number;
  consentGiven: boolean;
  consentGivenAt: string;
  answers: JobApplicationAnswerDto[];
  statusHistory: JobApplicationStatusHistoryDto[];
  notes: JobApplicationNoteDto[];
  interviews: JobInterviewDto[];
  communications: JobApplicationCommunicationDto[];
}

export interface RecruitmentStatsDto {
  totalJobs: number;
  publishedJobs: number;
  draftJobs: number;
  expiredJobs: number;
  totalApplications: number;
  receivedApplications: number;
  underReviewApplications: number;
  shortlistedApplications: number;
  onHoldApplications: number;
  interviewScheduledApplications: number;
  acceptedApplications: number;
  rejectedApplications: number;
  recentApplications: AdminJobApplicationListItemDto[];
  recentJobs: AdminJobListItemDto[];
  applicationsByDepartment: Array<{ department: string; count: number }>;
  applicationsByCategory: Array<{ category: string; count: number }>;
  applicationsByStatus: Record<string, number>;
}
