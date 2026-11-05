/**
 * PHASE 16 — Careers Page & Recruitment Management System Acceptance Tests
 * Real HTTP endpoints, real database, concurrency-safe Job ID generation,
 * PDF resume validation, RBAC enforcement, dynamic question evaluation,
 * application lifecycle, Google Meet scheduling, and email communications.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type {
  AdminJobApplicationDetailDto,
  AdminJobDetailDto,
  Paginated,
  PublicCareerCategoryDto,
  PublicJobDetailDto,
  PublicJobListItemDto,
  RecruitmentStatsDto,
} from '@asra/types';
import { createApp } from '../src/app.js';
import { disconnectPrisma } from '../src/database/prisma.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { resetAuthState } from './support/auth.js';
import { apiAs, tokenFor } from './support/catalog.js';
import { uniqueSuffix } from './support/fixtures.js';
import { startServer, TestClient } from './support/http.js';

let baseUrl: string;
let close: () => Promise<void>;
let testClient: TestClient;

before(async () => {
  ({ baseUrl, close } = await startServer(createApp()));
  testClient = new TestClient(baseUrl);
});

after(async () => {
  await close();
  await Promise.all([disconnectPrisma(), disconnectRedis()]);
});

beforeEach(async () => {
  await resetAuthState();
});

async function getAdminApi() {
  const token = await tokenFor(testClient, 'ADMIN');
  return apiAs(testClient, token);
}

async function getSuperAdminApi() {
  const token = await tokenFor(testClient, 'SUPER_ADMIN');
  return apiAs(testClient, token);
}

function getPublicApi() {
  return apiAs(testClient, undefined);
}

// Minimal valid PDF with %PDF- magic header
const VALID_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n168\n%%EOF',
);

describe('PHASE 16: Careers & Recruitment Management System', () => {
  describe('1. Concurrency-Safe Job & Application Sequence ID Generation', () => {
    it('generates unique sequential Job IDs with ASRA-JOB-YYYY-XXXXX format', async () => {
      const api = await getAdminApi();
      const s1 = uniqueSuffix();
      const s2 = uniqueSuffix();
      const currentYear = new Date().getFullYear();

      const res1 = await api<{ id: string; jobId: string }>('POST', '/admin/recruitment/jobs', {
        title: `Faculty Physics ${s1}`,
        department: 'Science',
        category: 'Teaching',
        employmentType: 'FULL_TIME',
        workLocation: 'Main Campus',
        workArrangement: 'ON_SITE',
        description: 'Comprehensive physics curriculum teacher for classes 11 and 12.',
        status: 'PUBLISHED',
      });
      assert.equal(res1.status, 201);
      assert.match(res1.body.data.jobId, new RegExp(`^ASRA-JOB-${currentYear}-\\d{5}$`));

      const res2 = await api<{ id: string; jobId: string }>('POST', '/admin/recruitment/jobs', {
        title: `Faculty Chemistry ${s2}`,
        department: 'Science',
        category: 'Teaching',
        employmentType: 'FULL_TIME',
        workLocation: 'Main Campus',
        workArrangement: 'ON_SITE',
        description: 'Comprehensive chemistry curriculum teacher.',
        status: 'PUBLISHED',
      });
      assert.equal(res2.status, 201);
      assert.match(res2.body.data.jobId, new RegExp(`^ASRA-JOB-${currentYear}-\\d{5}$`));

      // Must be distinct and sequentially increasing
      const num1 = parseInt(res1.body.data.jobId.split('-')[3]!, 10);
      const num2 = parseInt(res2.body.data.jobId.split('-')[3]!, 10);
      assert.equal(num2, num1 + 1);
    });

    it('preserves Job ID when updating job details', async () => {
      const api = await getAdminApi();
      const s = uniqueSuffix();

      const created = await api<{ id: string; jobId: string }>('POST', '/admin/recruitment/jobs', {
        title: `Initial Job Title ${s}`,
        department: 'Academics',
        category: 'Faculty',
        employmentType: 'FULL_TIME',
        workLocation: 'Hyderabad',
        description: 'Initial description with sufficient length',
        status: 'DRAFT',
      });
      assert.equal(created.status, 201);
      const initialJobId = created.body.data.jobId;

      const updated = await api<AdminJobDetailDto>(
        'PUT',
        `/admin/recruitment/jobs/${created.body.data.id}`,
        {
          title: `Updated Job Title ${s}`,
          department: 'Mathematics',
          category: 'Faculty',
          employmentType: 'PART_TIME',
          workLocation: 'Bengaluru',
          description: 'Updated comprehensive description',
        },
      );
      assert.equal(updated.status, 200);
      assert.equal(updated.body.data.jobId, initialJobId);
      assert.equal(updated.body.data.title, `Updated Job Title ${s}`);
    });
  });

  describe('2. Public Job Portal & Visibility Constraints', () => {
    it('exposes published active jobs and strictly hides draft and expired jobs', async () => {
      const adminApi = await getAdminApi();
      const publicApi = getPublicApi();
      const s = uniqueSuffix();

      // 1. Create a published active job
      const pubJob = await adminApi<{ id: string; jobId: string }>(
        'POST',
        '/admin/recruitment/jobs',
        {
          title: `Published Active Job ${s}`,
          department: 'Language',
          category: 'Teaching',
          employmentType: 'FULL_TIME',
          workLocation: 'Online',
          workArrangement: 'REMOTE',
          description: 'Arabic language instructor.',
          status: 'PUBLISHED',
          allowApplications: true,
        },
      );
      assert.equal(pubJob.status, 201);

      // 2. Create a draft job
      const draftJob = await adminApi<{ id: string; jobId: string }>(
        'POST',
        '/admin/recruitment/jobs',
        {
          title: `Draft Private Job ${s}`,
          department: 'Operations',
          category: 'Staff',
          employmentType: 'FULL_TIME',
          workLocation: 'Campus',
          workArrangement: 'ON_SITE',
          description: 'Internal operations assistant.',
          status: 'DRAFT',
          allowApplications: true,
        },
      );
      assert.equal(draftJob.status, 201);

      // 3. Create an expired job (closingDate in the past)
      const expiredJob = await adminApi<{ id: string; jobId: string }>(
        'POST',
        '/admin/recruitment/jobs',
        {
          title: `Expired Job ${s}`,
          department: 'Science',
          category: 'Teaching',
          employmentType: 'CONTRACT',
          workLocation: 'Campus',
          workArrangement: 'ON_SITE',
          description: 'Past term instructor.',
          status: 'PUBLISHED',
          closingDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          allowApplications: true,
        },
      );
      assert.equal(expiredJob.status, 201);

      // Public list should contain pubJob, but NOT draftJob or expiredJob
      const listRes = await publicApi<Paginated<PublicJobListItemDto>>('GET', '/careers');
      assert.equal(listRes.status, 200);
      const jobIds = listRes.body.data.items.map((j) => j.jobId);
      assert.ok(jobIds.includes(pubJob.body.data.jobId));
      assert.ok(!jobIds.includes(draftJob.body.data.jobId));
      assert.ok(!jobIds.includes(expiredJob.body.data.jobId));

      // Direct public GET for draft job returns 404
      const draftDetail = await publicApi<PublicJobDetailDto>(
        'GET',
        `/careers/${draftJob.body.data.jobId}`,
      );
      assert.equal(draftDetail.status, 404);

      // Direct public GET for expired job returns 404
      const expiredDetail = await publicApi<PublicJobDetailDto>(
        'GET',
        `/careers/${expiredJob.body.data.jobId}`,
      );
      assert.equal(expiredDetail.status, 404);
    });

    it('respects salary public visibility flag', async () => {
      const adminApi = await getAdminApi();
      const publicApi = getPublicApi();
      const s = uniqueSuffix();

      // Job with private salary
      const privJob = await adminApi<{ id: string; jobId: string }>(
        'POST',
        '/admin/recruitment/jobs',
        {
          title: `Private Salary Role ${s}`,
          department: 'Administration',
          category: 'Management',
          employmentType: 'FULL_TIME',
          workLocation: 'Campus',
          description: 'Administrator role for campus operations.',
          status: 'PUBLISHED',
          salaryMin: 800000,
          salaryMax: 1200000,
          isSalaryPublic: false,
        },
      );
      assert.equal(privJob.status, 201);

      const pubDetail = await publicApi<PublicJobDetailDto>(
        'GET',
        `/careers/${privJob.body.data.jobId}`,
      );
      assert.equal(pubDetail.status, 200);
      assert.equal(pubDetail.body.data.isSalaryPublic, false);
      assert.equal(pubDetail.body.data.salaryMin, null);
      assert.equal(pubDetail.body.data.salaryMax, null);
    });

    it('returns active published categories and excludes draft and expired categories with Cache-Control headers', async () => {
      const adminApi = await getAdminApi();
      const publicApi = getPublicApi();
      const s = uniqueSuffix();

      // 1. Create a published job with unique category
      const uniqueCat = `Cat_${s}`;
      const pubJob = await adminApi<{ id: string; jobId: string }>(
        'POST',
        '/admin/recruitment/jobs',
        {
          title: `Active Cat Job ${s}`,
          department: 'Academics',
          category: uniqueCat,
          employmentType: 'FULL_TIME',
          workLocation: 'Online',
          description: 'Job with unique category for public categories test.',
          status: 'PUBLISHED',
          allowApplications: true,
        },
      );
      assert.equal(pubJob.status, 201);

      // 2. Create a draft job with another unique category
      const draftCat = `DraftCat_${s}`;
      const draftJob = await adminApi<{ id: string; jobId: string }>(
        'POST',
        '/admin/recruitment/jobs',
        {
          title: `Draft Cat Job ${s}`,
          department: 'Academics',
          category: draftCat,
          employmentType: 'FULL_TIME',
          workLocation: 'Online',
          description: 'Draft job category should not appear publicly.',
          status: 'DRAFT',
          allowApplications: true,
        },
      );
      assert.equal(draftJob.status, 201);

      // 3. Request /careers/categories
      const catRes = await publicApi<PublicCareerCategoryDto[]>('GET', '/careers/categories');
      assert.equal(catRes.status, 200);

      const cats = catRes.body.data;
      const foundActive = cats.find((c) => c.category.toLowerCase() === uniqueCat.toLowerCase());
      assert.ok(foundActive, `Expected ${uniqueCat} in public categories`);
      assert.ok(foundActive.count >= 1);
      assert.ok(foundActive.label.length > 0);

      const foundDraft = cats.find((c) => c.category.toLowerCase() === draftCat.toLowerCase());
      assert.equal(foundDraft, undefined, `Expected ${draftCat} to NOT be in public categories`);
    });
  });

  describe('3. Dynamic Screening Questions & Answer Snapshots', () => {
    it('configures dynamic questions and validates candidate answers on submission', async () => {
      const adminApi = await getAdminApi();
      const publicApi = getPublicApi();
      const s = uniqueSuffix();

      // 1. Upload valid resume first
      const resumeRes = await publicApi<{
        resumeAssetId: string;
        resumeFileName: string;
        resumeFileSize: number;
      }>('POST', '/careers/upload-resume', {
        fileBase64: VALID_PDF_BUFFER.toString('base64'),
        fileName: 'candidate_cv.pdf',
      });
      assert.equal(resumeRes.status, 201);
      const { resumeAssetId, resumeFileName, resumeFileSize } = resumeRes.body.data;

      // 2. Admin creates job with 4 dynamic questions
      const jobRes = await adminApi<AdminJobDetailDto>('POST', '/admin/recruitment/jobs', {
        title: `Quranic Studies Instructor ${s}`,
        department: 'Theology',
        category: 'Teaching',
        employmentType: 'FULL_TIME',
        workLocation: 'Campus',
        description: 'Quranic recitation and classical tafseer instructor.',
        status: 'PUBLISHED',
        questions: [
          {
            label: 'Years of Tajweed Teaching Experience',
            fieldType: 'NUMBER',
            required: true,
            displayOrder: 1,
            validation: { min: 2, max: 40 },
          },
          {
            label: 'Do you hold an Ijazah in Hafs?',
            fieldType: 'YES_NO',
            required: true,
            displayOrder: 2,
          },
          {
            label: 'Teaching Board Familiarity',
            fieldType: 'SINGLE_SELECT',
            required: true,
            options: ['CBSE', 'ICSE', 'Cambridge IGCSE', 'State Board'],
            displayOrder: 3,
          },
          {
            label: 'Statement of Teaching Philosophy',
            fieldType: 'LONG_TEXT',
            required: false,
            displayOrder: 4,
            validation: { maxLength: 500 },
          },
        ],
      });
      assert.equal(jobRes.status, 201);
      const job = jobRes.body.data;
      const [qNum, qYesNo, qSelect, qText] = job.questions;
      if (!qNum || !qYesNo || !qSelect || !qText) {
        throw new Error('Expected 4 screening questions to be returned');
      }

      // 3. Attempt submission with missing required answers -> 422
      const invalidSub1 = await publicApi('POST', `/careers/${job.jobId}/apply`, {
        fullName: 'Zaid Al-Farooq',
        email: `zaid.${s}@example.com`,
        phone: '9876543210',
        currentCity: 'Lucknow',
        resumeAssetId,
        resumeFileName,
        resumeFileSize,
        consentGiven: true,
        answers: [], // Missing required questions!
      });
      assert.equal(invalidSub1.status, 422);

      // 4. Attempt submission with NUMBER out of range (value: 1 when min: 2) -> 422
      const invalidSub2 = await publicApi('POST', `/careers/${job.jobId}/apply`, {
        fullName: 'Zaid Al-Farooq',
        email: `zaid.${s}@example.com`,
        phone: '9876543210',
        currentCity: 'Lucknow',
        resumeAssetId,
        resumeFileName,
        resumeFileSize,
        consentGiven: true,
        answers: [
          { questionId: qNum.id, value: 1 },
          { questionId: qYesNo.id, value: true },
          { questionId: qSelect.id, value: 'CBSE' },
        ],
      });
      assert.equal(invalidSub2.status, 422);

      // 5. Attempt submission with invalid SELECT option ('InvalidBoard') -> 422
      const invalidSub3 = await publicApi('POST', `/careers/${job.jobId}/apply`, {
        fullName: 'Zaid Al-Farooq',
        email: `zaid.${s}@example.com`,
        phone: '9876543210',
        currentCity: 'Lucknow',
        resumeAssetId,
        resumeFileName,
        resumeFileSize,
        consentGiven: true,
        answers: [
          { questionId: qNum.id, value: 5 },
          { questionId: qYesNo.id, value: true },
          { questionId: qSelect.id, value: 'InvalidBoard' },
        ],
      });
      assert.equal(invalidSub3.status, 422);

      // 6. Valid submission -> 201 Created with ASRA-APP-YYYY-XXXXX reference ID
      const validSub = await publicApi<{ id: string; referenceId: string }>(
        'POST',
        `/careers/${job.jobId}/apply`,
        {
          fullName: 'Zaid Al-Farooq',
          email: `Zaid.Farooq.${s}@Example.COM`, // Test email normalization
          phone: '+91 98765 43210', // Test phone normalization
          currentCity: 'Lucknow, Uttar Pradesh',
          resumeAssetId,
          resumeFileName,
          resumeFileSize,
          consentGiven: true,
          answers: [
            { questionId: qNum.id, value: 5 },
            { questionId: qYesNo.id, value: true },
            { questionId: qSelect.id, value: 'CBSE' },
            { questionId: qText.id, value: 'I believe in holistic, character-centered teaching.' },
          ],
        },
      );
      assert.equal(validSub.status, 201);
      const currentYear = new Date().getFullYear();
      assert.match(validSub.body.data.referenceId, new RegExp(`^ASRA-APP-${currentYear}-\\d{5}$`));

      // 7. Verify admin detail view contains snapshot of questions and answers
      const appDetail = await adminApi<AdminJobApplicationDetailDto>(
        'GET',
        `/admin/recruitment/applications/${validSub.body.data.id}`,
      );
      assert.equal(appDetail.status, 200);
      assert.equal(appDetail.body.data.fullName, 'Zaid Al-Farooq');
      assert.equal(appDetail.body.data.email, `zaid.farooq.${s.toLowerCase()}@example.com`);
      assert.equal(appDetail.body.data.phone, '9876543210');
      assert.equal(appDetail.body.data.answers.length, 4);

      // Verify questionLabel snapshot
      const numAnswer = appDetail.body.data.answers.find((a) => a.questionId === qNum.id);
      assert.ok(numAnswer);
      assert.equal(numAnswer?.questionLabel, 'Years of Tajweed Teaching Experience');
      assert.equal(numAnswer?.fieldType, 'NUMBER');
    });
  });

  describe('4. Duplicate Application Prevention', () => {
    it('rejects duplicate application to the same job with 409 Conflict', async () => {
      const adminApi = await getAdminApi();
      const publicApi = getPublicApi();
      const s = uniqueSuffix();

      // Create job
      const jobRes = await adminApi<{ id: string; jobId: string }>(
        'POST',
        '/admin/recruitment/jobs',
        {
          title: `History Faculty ${s}`,
          department: 'Humanities',
          category: 'Teaching',
          employmentType: 'FULL_TIME',
          workLocation: 'Main Campus',
          description: 'Islamic and World History curriculum.',
          status: 'PUBLISHED',
        },
      );
      assert.equal(jobRes.status, 201);
      const jobId = jobRes.body.data.jobId;

      // Upload resume
      const resumeRes = await publicApi<{
        resumeAssetId: string;
        resumeFileName: string;
        resumeFileSize: number;
      }>('POST', '/careers/upload-resume', {
        fileBase64: VALID_PDF_BUFFER.toString('base64'),
        fileName: 'fatima_cv.pdf',
      });
      const { resumeAssetId, resumeFileName, resumeFileSize } = resumeRes.body.data;

      // First submission
      const sub1 = await publicApi('POST', `/careers/${jobId}/apply`, {
        fullName: 'Fatima Zahra',
        email: `Fatima.Zahra.${s}@Test.com`,
        phone: '9876543211',
        currentCity: 'Delhi',
        resumeAssetId,
        resumeFileName,
        resumeFileSize,
        consentGiven: true,
      });
      assert.equal(sub1.status, 201);

      // Second submission to same job with case-variation of email -> 409 Conflict
      const sub2 = await publicApi('POST', `/careers/${jobId}/apply`, {
        fullName: 'Fatima Zahra',
        email: `fatima.zahra.${s}@test.COM`,
        phone: '9876543211',
        currentCity: 'Delhi',
        resumeAssetId,
        resumeFileName,
        resumeFileSize,
        consentGiven: true,
      });
      assert.equal(sub2.status, 409);
      assert.equal(sub2.body.message, 'You have already applied for this position');
    });

    it('allows same candidate to apply to a DIFFERENT job vacancy', async () => {
      const adminApi = await getAdminApi();
      const publicApi = getPublicApi();
      const s = uniqueSuffix();

      // Create job 1
      const job1 = await adminApi<{ id: string; jobId: string }>(
        'POST',
        '/admin/recruitment/jobs',
        {
          title: `Role A ${s}`,
          department: 'Academics',
          category: 'Teaching',
          employmentType: 'FULL_TIME',
          workLocation: 'Campus',
          description: 'Role A comprehensive description.',
          status: 'PUBLISHED',
        },
      );
      assert.equal(job1.status, 201);

      // Create job 2
      const job2 = await adminApi<{ id: string; jobId: string }>(
        'POST',
        '/admin/recruitment/jobs',
        {
          title: `Role B ${s}`,
          department: 'Academics',
          category: 'Teaching',
          employmentType: 'FULL_TIME',
          workLocation: 'Campus',
          description: 'Role B comprehensive description.',
          status: 'PUBLISHED',
        },
      );
      assert.equal(job2.status, 201);

      // Upload resume
      const resumeRes = await publicApi<{
        resumeAssetId: string;
        resumeFileName: string;
        resumeFileSize: number;
      }>('POST', '/careers/upload-resume', {
        fileBase64: VALID_PDF_BUFFER.toString('base64'),
        fileName: 'resume.pdf',
      });
      const { resumeAssetId, resumeFileName, resumeFileSize } = resumeRes.body.data;

      const candidateEmail = `applicant.${s}@domain.com`;

      // Apply to Job 1 -> 201
      const res1 = await publicApi('POST', `/careers/${job1.body.data.jobId}/apply`, {
        fullName: 'Same Candidate',
        email: candidateEmail,
        phone: '9876543212',
        currentCity: 'Mumbai',
        resumeAssetId,
        resumeFileName,
        resumeFileSize,
        consentGiven: true,
      });
      assert.equal(res1.status, 201);

      // Apply to Job 2 with same email -> 201
      const res2 = await publicApi('POST', `/careers/${job2.body.data.jobId}/apply`, {
        fullName: 'Same Candidate',
        email: candidateEmail,
        phone: '9876543212',
        currentCity: 'Mumbai',
        resumeAssetId,
        resumeFileName,
        resumeFileSize,
        consentGiven: true,
      });
      assert.equal(res2.status, 201);
    });
  });

  describe('5. Resume Validation Security', () => {
    it('rejects corrupted or non-PDF files', async () => {
      const publicApi = getPublicApi();

      // Text file disguised as PDF
      const fakePdf = Buffer.from('This is a plain text file pretending to be PDF');
      const res = await publicApi('POST', '/careers/upload-resume', {
        fileBase64: fakePdf.toString('base64'),
        fileName: 'malicious.pdf',
      });
      assert.equal(res.status, 422);
    });

    it('rejects files exceeding 5MB size limit', async () => {
      const publicApi = getPublicApi();

      // 5.5 MB buffer with PDF header
      const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024);
      largeBuffer.write('%PDF-1.4\n');

      const res = await publicApi('POST', '/careers/upload-resume', {
        fileBase64: largeBuffer.toString('base64'),
        fileName: 'huge_portfolio.pdf',
      });
      assert.ok([413, 422].includes(res.status));
    });
  });

  describe('6. RBAC & Access Control Enforcement', () => {
    it('denies recruitment administration to unauthenticated, student, and faculty users', async () => {
      const anonApi = getPublicApi();
      const studentToken = await tokenFor(testClient, 'STUDENT');
      const facultyToken = await tokenFor(testClient, 'FACULTY');
      const studentApi = apiAs(testClient, studentToken);
      const facultyApi = apiAs(testClient, facultyToken);

      // Anonymous -> 401
      const resAnon = await anonApi('GET', '/admin/recruitment/stats');
      assert.equal(resAnon.status, 401);

      // Student -> 403
      const resStudent = await studentApi('GET', '/admin/recruitment/stats');
      assert.equal(resStudent.status, 403);

      // Faculty -> 403
      const resFaculty = await facultyApi('GET', '/admin/recruitment/stats');
      assert.equal(resFaculty.status, 403);
    });

    it('grants recruitment administration to ADMIN and SUPER_ADMIN users', async () => {
      const adminApi = await getAdminApi();
      const superAdminApi = await getSuperAdminApi();

      const resAdmin = await adminApi<RecruitmentStatsDto>('GET', '/admin/recruitment/stats');
      assert.equal(resAdmin.status, 200);
      assert.ok(typeof resAdmin.body.data.totalJobs === 'number');

      const resSuper = await superAdminApi<RecruitmentStatsDto>('GET', '/admin/recruitment/stats');
      assert.equal(resSuper.status, 200);
      assert.ok(typeof resSuper.body.data.totalJobs === 'number');
    });
  });

  describe('7. Recruitment Lifecycle: Review, Interviews, Notes & Communications', () => {
    it('manages candidate status transitions, Google Meet interviews, private notes, and custom emails', async () => {
      const adminApi = await getAdminApi();
      const publicApi = getPublicApi();
      const s = uniqueSuffix();

      // Create job
      const jobRes = await adminApi<{ id: string; jobId: string }>(
        'POST',
        '/admin/recruitment/jobs',
        {
          title: `Senior Principal ${s}`,
          department: 'Leadership',
          category: 'Administration',
          employmentType: 'FULL_TIME',
          workLocation: 'Main Campus',
          description: 'Academy principal leadership role.',
          status: 'PUBLISHED',
        },
      );
      assert.equal(jobRes.status, 201);
      const jobId = jobRes.body.data.jobId;

      // Upload resume
      const resumeRes = await publicApi<{
        resumeAssetId: string;
        resumeFileName: string;
        resumeFileSize: number;
      }>('POST', '/careers/upload-resume', {
        fileBase64: VALID_PDF_BUFFER.toString('base64'),
        fileName: 'principal_cv.pdf',
      });
      const { resumeAssetId, resumeFileName, resumeFileSize } = resumeRes.body.data;

      // Submit application
      const sub = await publicApi<{ id: string; referenceId: string }>(
        'POST',
        `/careers/${jobId}/apply`,
        {
          fullName: 'Dr. Tariq Mahmood',
          email: `dr.tariq.${s}@example.com`,
          phone: '9876543219',
          currentCity: 'Hyderabad',
          resumeAssetId,
          resumeFileName,
          resumeFileSize,
          consentGiven: true,
        },
      );
      assert.equal(sub.status, 201);
      const applicationId = sub.body.data.id;

      // 1. Initial status is RECEIVED
      let detail = await adminApi<AdminJobApplicationDetailDto>(
        'GET',
        `/admin/recruitment/applications/${applicationId}`,
      );
      assert.equal(detail.body.data.status, 'RECEIVED');

      // 2. Transition: UNDER_REVIEW
      const revRes = await adminApi(
        'POST',
        `/admin/recruitment/applications/${applicationId}/status`,
        {
          status: 'UNDER_REVIEW',
          reason: 'Credentials match institutional criteria.',
        },
      );
      assert.equal(revRes.status, 200);

      // 3. Transition: SHORTLISTED
      const shortRes = await adminApi(
        'POST',
        `/admin/recruitment/applications/${applicationId}/status`,
        {
          status: 'SHORTLISTED',
          reason: 'Recommended for panel interview by academic search committee.',
          sendEmail: true,
        },
      );
      assert.equal(shortRes.status, 200);

      // 4. Schedule Google Meet interview -> sets status to INTERVIEW_SCHEDULED
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const schedRes = await adminApi(
        'POST',
        `/admin/recruitment/applications/${applicationId}/interviews`,
        {
          scheduledAt: tomorrow,
          durationMinutes: 45,
          interviewType: 'Academic Leadership Panel',
          meetingUrl: 'https://meet.google.com/abc-defg-hij',
          instructions: 'Please be prepared to discuss strategic institutional growth.',
          sendEmail: true,
        },
      );
      assert.equal(schedRes.status, 201);

      // Verify status auto-transitioned to INTERVIEW_SCHEDULED
      detail = await adminApi<AdminJobApplicationDetailDto>(
        'GET',
        `/admin/recruitment/applications/${applicationId}`,
      );
      assert.equal(detail.body.data.status, 'INTERVIEW_SCHEDULED');
      assert.equal(detail.body.data.interviews.length, 1);
      assert.equal(
        detail.body.data.interviews[0]!.meetingUrl,
        'https://meet.google.com/abc-defg-hij',
      );

      // 5. Add confidential internal note
      const noteRes = await adminApi(
        'POST',
        `/admin/recruitment/applications/${applicationId}/notes`,
        {
          note: 'Candidate demonstrated deep pedagogical expertise and strong alignment with values.',
        },
      );
      assert.equal(noteRes.status, 201);

      // Verify note in detail
      detail = await adminApi<AdminJobApplicationDetailDto>(
        'GET',
        `/admin/recruitment/applications/${applicationId}`,
      );
      assert.equal(detail.body.data.notes.length, 1);
      assert.match(
        detail.body.data.notes[0]!.note,
        /Candidate demonstrated deep pedagogical expertise/,
      );

      // 6. Send custom candidate recruitment email
      const emailRes = await adminApi(
        'POST',
        `/admin/recruitment/applications/${applicationId}/email`,
        {
          template: 'CUSTOM_RECRUITMENT',
          subject: 'Formal Offer Discussion - ASRA Academy',
          adminMessage:
            'We are delighted to invite you for a formal discussion regarding the Senior Principal role.',
        },
      );
      assert.equal(emailRes.status, 200);

      // Verify communication logged
      detail = await adminApi<AdminJobApplicationDetailDto>(
        'GET',
        `/admin/recruitment/applications/${applicationId}`,
      );
      assert.ok(detail.body.data.communications.length >= 1);
      const emailLog = detail.body.data.communications.find((c) =>
        c.subject.includes('Formal Offer Discussion'),
      );
      assert.ok(emailLog);

      // 7. Transition: ACCEPTED
      const acceptRes = await adminApi(
        'POST',
        `/admin/recruitment/applications/${applicationId}/status`,
        {
          status: 'ACCEPTED',
          reason: 'Formally accepted offer.',
          sendEmail: true,
        },
      );
      assert.equal(acceptRes.status, 200);

      detail = await adminApi<AdminJobApplicationDetailDto>(
        'GET',
        `/admin/recruitment/applications/${applicationId}`,
      );
      assert.equal(detail.body.data.status, 'ACCEPTED');

      // 8. Stream resume download
      const adminToken = await tokenFor(testClient, 'ADMIN');
      const rawRes = await fetch(
        `${baseUrl}/api/v1/admin/recruitment/applications/${applicationId}/resume`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );
      assert.equal(rawRes.status, 200);
      assert.equal(rawRes.headers.get('content-type'), 'application/pdf');
      const pdfText = await rawRes.text();
      assert.ok(pdfText.startsWith('%PDF-'));
    });
  });
});
