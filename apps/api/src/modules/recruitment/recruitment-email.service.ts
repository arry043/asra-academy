import type { DbClient } from '../../database/types.js';
import { emailService } from '../../email/email.service.js';
import { renderBrandedEmail } from '../../email/templates.js';
import { logger } from '../../lib/logger.js';

export interface BaseRecruitmentEmailContext {
  applicantName: string;
  applicantEmail: string;
  jobTitle: string;
  jobId: string;
  applicationReferenceId: string;
  adminMessage?: string | null;
}

export interface InterviewEmailContext extends BaseRecruitmentEmailContext {
  interviewDate: string;
  interviewTime: string;
  timezone: string;
  durationMinutes: number;
  meetingUrl: string;
  interviewType: string;
  instructions?: string | null;
}

export interface StatusEmailContext extends BaseRecruitmentEmailContext {
  reason?: string | null;
  followUpDate?: string | null;
}

export class RecruitmentEmailService {
  /**
   * Helper to perform variable substitution in custom messages.
   */
  public interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      return vars[key] ?? match;
    });
  }

  /**
   * Sends an email, recording the attempt in `job_application_communications`.
   * Never throws if email sending fails, so business transactions are preserved.
   */
  private async sendAndLog(
    db: DbClient,
    applicationId: string,
    recipientEmail: string,
    templateName: string,
    rendered: { subject: string; text: string; html: string },
    sentById: string | null = null,
  ): Promise<void> {
    const idempotencyKey = `recruitment-${applicationId}-${templateName}-${Date.now()}`;

    // Create record initially as PENDING/SENT
    const comm = await db.jobApplicationCommunication.create({
      data: {
        applicationId,
        recipientEmail,
        template: templateName,
        subject: rendered.subject,
        messageText: rendered.text,
        messageHtml: rendered.html,
        status: 'PENDING',
        sentById,
      },
    });

    try {
      const receipt = await emailService.sendNotification(recipientEmail, rendered, idempotencyKey);

      await db.jobApplicationCommunication.update({
        where: { id: comm.id },
        data: {
          status: 'SENT',
          providerMessageId: receipt.providerMessageId,
        },
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown email delivery failure';
      logger.warn(
        { err, applicationId, recipientEmail, templateName },
        'Failed to deliver recruitment email',
      );

      await db.jobApplicationCommunication.update({
        where: { id: comm.id },
        data: {
          status: 'FAILED',
          error: errorMsg.slice(0, 500),
        },
      });
    }
  }

  /**
   * 1. Application Received Confirmation
   */
  public async sendApplicationReceived(
    db: DbClient,
    applicationId: string,
    ctx: BaseRecruitmentEmailContext,
  ): Promise<void> {
    const subject = `Application Received — ${ctx.jobTitle} (${ctx.jobId})`;
    const rendered = renderBrandedEmail({
      recipientName: ctx.applicantName,
      subject,
      heading: 'Application Received',
      intro: `Thank you for your interest in joining ASRA Academy! We have successfully received your application for the position of ${ctx.jobTitle}.`,
      details: [
        { label: 'Position', value: ctx.jobTitle },
        { label: 'Job ID', value: ctx.jobId },
        { label: 'Application Reference', value: ctx.applicationReferenceId },
        {
          label: 'Status',
          value: 'Under Review by our Academic Recruitment Team',
        },
      ],
      footnote:
        'Our recruitment team will review your application and resume. If your profile matches our requirements, we will reach out regarding next steps. Please keep your Application Reference handy for any communications.',
    });

    await this.sendAndLog(db, applicationId, ctx.applicantEmail, 'application_received', rendered);
  }

  /**
   * 2. Application Shortlisted
   */
  public async sendApplicationShortlisted(
    db: DbClient,
    applicationId: string,
    ctx: BaseRecruitmentEmailContext,
    sentById: string | null = null,
  ): Promise<void> {
    const subject = `Update on your application for ${ctx.jobTitle} (${ctx.jobId}) — Shortlisted`;
    const intro = ctx.adminMessage
      ? ctx.adminMessage
      : `We are pleased to inform you that your application for ${ctx.jobTitle} has been shortlisted for the next phase of our hiring process.`;

    const rendered = renderBrandedEmail({
      recipientName: ctx.applicantName,
      subject,
      heading: 'Application Shortlisted',
      intro,
      details: [
        { label: 'Position', value: ctx.jobTitle },
        { label: 'Job ID', value: ctx.jobId },
        { label: 'Application Reference', value: ctx.applicationReferenceId },
        { label: 'Current Status', value: 'Shortlisted' },
      ],
      footnote:
        'Our team will contact you shortly with interview details. Thank you for your continued interest in ASRA Academy.',
    });

    await this.sendAndLog(
      db,
      applicationId,
      ctx.applicantEmail,
      'application_shortlisted',
      rendered,
      sentById,
    );
  }

  /**
   * 3. Application On Hold
   */
  public async sendApplicationOnHold(
    db: DbClient,
    applicationId: string,
    ctx: StatusEmailContext,
    sentById: string | null = null,
  ): Promise<void> {
    const subject = `Application Status Update — ${ctx.jobTitle} (${ctx.jobId})`;
    const intro = ctx.adminMessage
      ? ctx.adminMessage
      : `Thank you for taking the time to apply for ${ctx.jobTitle} at ASRA Academy. We wanted to let you know that your application is currently on hold while we evaluate our scheduling and departmental needs.`;

    const details = [
      { label: 'Position', value: ctx.jobTitle },
      { label: 'Job ID', value: ctx.jobId },
      { label: 'Application Reference', value: ctx.applicationReferenceId },
      { label: 'Status', value: 'On Hold' },
    ];

    if (ctx.reason) {
      details.push({ label: 'Details', value: ctx.reason });
    }
    if (ctx.followUpDate) {
      details.push({
        label: 'Expected Follow-up',
        value: new Date(ctx.followUpDate).toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
        }),
      });
    }

    const rendered = renderBrandedEmail({
      recipientName: ctx.applicantName,
      subject,
      heading: 'Application On Hold',
      intro,
      details,
      footnote:
        'We appreciate your patience. We will keep your profile on file and update you as soon as there is a development.',
    });

    await this.sendAndLog(
      db,
      applicationId,
      ctx.applicantEmail,
      'application_on_hold',
      rendered,
      sentById,
    );
  }

  /**
   * 4. Interview Scheduled
   */
  public async sendInterviewScheduled(
    db: DbClient,
    applicationId: string,
    ctx: InterviewEmailContext,
    sentById: string | null = null,
  ): Promise<void> {
    const subject = `Interview Invitation — ${ctx.jobTitle} (${ctx.jobId}) — ASRA Academy`;
    const intro = ctx.adminMessage
      ? ctx.adminMessage
      : `You are invited to an interview for the position of ${ctx.jobTitle} with ASRA Academy. Please review the schedule and joining link below.`;

    const details = [
      { label: 'Position', value: ctx.jobTitle },
      { label: 'Interview Type', value: ctx.interviewType },
      {
        label: 'Date & Time',
        value: `${ctx.interviewDate} at ${ctx.interviewTime} (${ctx.timezone})`,
      },
      { label: 'Duration', value: `${ctx.durationMinutes} minutes` },
      { label: 'Google Meet', value: ctx.meetingUrl },
    ];

    if (ctx.instructions) {
      details.push({ label: 'Instructions', value: ctx.instructions });
    }

    const rendered = renderBrandedEmail({
      recipientName: ctx.applicantName,
      subject,
      heading: 'Interview Invitation',
      intro,
      details,
      action: {
        label: 'Join Google Meet',
        url: ctx.meetingUrl,
      },
      footnote:
        'Please join the meeting 5 minutes before the scheduled time in a quiet environment with a working microphone and camera.',
    });

    await this.sendAndLog(
      db,
      applicationId,
      ctx.applicantEmail,
      'interview_scheduled',
      rendered,
      sentById,
    );
  }

  /**
   * 5. Interview Rescheduled
   */
  public async sendInterviewRescheduled(
    db: DbClient,
    applicationId: string,
    ctx: InterviewEmailContext,
    sentById: string | null = null,
  ): Promise<void> {
    const subject = `Interview Rescheduled — ${ctx.jobTitle} (${ctx.jobId}) — ASRA Academy`;
    const intro = ctx.adminMessage
      ? ctx.adminMessage
      : `Please note that your interview for the position of ${ctx.jobTitle} has been rescheduled. Your updated interview details are below.`;

    const details = [
      { label: 'Position', value: ctx.jobTitle },
      { label: 'Interview Type', value: ctx.interviewType },
      {
        label: 'New Date & Time',
        value: `${ctx.interviewDate} at ${ctx.interviewTime} (${ctx.timezone})`,
      },
      { label: 'Duration', value: `${ctx.durationMinutes} minutes` },
      { label: 'Google Meet', value: ctx.meetingUrl },
    ];

    if (ctx.instructions) {
      details.push({ label: 'Instructions', value: ctx.instructions });
    }

    const rendered = renderBrandedEmail({
      recipientName: ctx.applicantName,
      subject,
      heading: 'Interview Rescheduled',
      intro,
      details,
      action: {
        label: 'Join Google Meet',
        url: ctx.meetingUrl,
      },
      footnote: 'We apologize for any inconvenience caused by this schedule adjustment.',
    });

    await this.sendAndLog(
      db,
      applicationId,
      ctx.applicantEmail,
      'interview_rescheduled',
      rendered,
      sentById,
    );
  }

  /**
   * 6. Interview Cancelled
   */
  public async sendInterviewCancelled(
    db: DbClient,
    applicationId: string,
    ctx: BaseRecruitmentEmailContext & { reason: string },
    sentById: string | null = null,
  ): Promise<void> {
    const subject = `Interview Cancelled — ${ctx.jobTitle} (${ctx.jobId}) — ASRA Academy`;
    const intro = ctx.adminMessage
      ? ctx.adminMessage
      : `Please be advised that your upcoming interview for the position of ${ctx.jobTitle} has been cancelled.`;

    const rendered = renderBrandedEmail({
      recipientName: ctx.applicantName,
      subject,
      heading: 'Interview Cancelled',
      intro,
      details: [
        { label: 'Position', value: ctx.jobTitle },
        { label: 'Reason', value: ctx.reason },
      ],
      footnote:
        'If you have any questions or need to follow up, please reply to this email or contact ASRA Academy Recruitment.',
    });

    await this.sendAndLog(
      db,
      applicationId,
      ctx.applicantEmail,
      'interview_cancelled',
      rendered,
      sentById,
    );
  }

  /**
   * 7. Application Accepted
   */
  public async sendApplicationAccepted(
    db: DbClient,
    applicationId: string,
    ctx: BaseRecruitmentEmailContext,
    sentById: string | null = null,
  ): Promise<void> {
    const subject = `Congratulations! Offer / Acceptance for ${ctx.jobTitle} (${ctx.jobId}) — ASRA Academy`;
    const intro = ctx.adminMessage
      ? ctx.adminMessage
      : `We are delighted to inform you that you have been selected for the position of ${ctx.jobTitle} at ASRA Academy! We were very impressed with your background, skills and interview performance.`;

    const rendered = renderBrandedEmail({
      recipientName: ctx.applicantName,
      subject,
      heading: 'Congratulations on Your Selection!',
      intro,
      details: [
        { label: 'Position', value: ctx.jobTitle },
        { label: 'Job ID', value: ctx.jobId },
        { label: 'Application Reference', value: ctx.applicationReferenceId },
        { label: 'Status', value: 'Accepted / Selected' },
      ],
      footnote:
        'Our administration team will follow up directly regarding onboarding paperwork, formal contract details, and commencement date. Welcome to ASRA Academy!',
    });

    await this.sendAndLog(
      db,
      applicationId,
      ctx.applicantEmail,
      'application_accepted',
      rendered,
      sentById,
    );
  }

  /**
   * 8. Application Rejected
   */
  public async sendApplicationRejected(
    db: DbClient,
    applicationId: string,
    ctx: StatusEmailContext,
    sentById: string | null = null,
  ): Promise<void> {
    const subject = `Update on your application for ${ctx.jobTitle} (${ctx.jobId}) — ASRA Academy`;
    const intro = ctx.adminMessage
      ? ctx.adminMessage
      : `Thank you for your interest in ASRA Academy and for taking the time to apply for the position of ${ctx.jobTitle}. After careful consideration of all applications, we have decided to proceed with other candidates whose qualifications more closely align with our current needs.`;

    const details = [
      { label: 'Position', value: ctx.jobTitle },
      { label: 'Application Reference', value: ctx.applicationReferenceId },
    ];

    if (ctx.reason) {
      details.push({ label: 'Feedback / Note', value: ctx.reason });
    }

    const rendered = renderBrandedEmail({
      recipientName: ctx.applicantName,
      subject,
      heading: 'Application Update',
      intro,
      details,
      footnote:
        'We sincerely appreciate your interest in our institution and wish you every success in your professional endeavors.',
    });

    await this.sendAndLog(
      db,
      applicationId,
      ctx.applicantEmail,
      'application_rejected',
      rendered,
      sentById,
    );
  }

  /**
   * 9. Custom Email
   */
  public async sendCustomEmail(
    db: DbClient,
    applicationId: string,
    recipientEmail: string,
    recipientName: string,
    subject: string,
    messageText: string,
    sentById: string | null = null,
  ): Promise<void> {
    const rendered = renderBrandedEmail({
      recipientName,
      subject,
      heading: subject,
      intro: messageText,
      footnote: 'This message was sent from ASRA Academy Recruitment.',
    });

    await this.sendAndLog(db, applicationId, recipientEmail, 'custom', rendered, sentById);
  }
}

export const recruitmentEmailService = new RecruitmentEmailService();
