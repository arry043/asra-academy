'use client';

import type { JobQuestionDto, PublicJobDetailDto } from '@asra/types';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Container } from '@/components/layout/container';
import { DynamicQuestionInput } from '@/components/public/careers/dynamic-question-input';
import {
  ResumeUploader,
  type UploadedResumeInfo,
} from '@/components/public/careers/resume-uploader';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/api';

interface JobApplyFormProps {
  job: PublicJobDetailDto;
}

interface SubmittedApplicationSuccess {
  referenceId: string;
  jobId: string;
  fullName: string;
  email: string;
  submittedAt: string;
}

export function JobApplyForm({ job }: JobApplyFormProps) {
  // Form State
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [city, setCity] = React.useState('');
  const [consentGiven, setConsentGiven] = React.useState(false);
  const [uploadedResume, setUploadedResume] = React.useState<UploadedResumeInfo | null>(null);

  // Dynamic answers map: questionId -> value
  const [answers, setAnswers] = React.useState<
    Record<string, string | string[] | boolean | number>
  >({});

  // UI State
  const [step, setStep] = React.useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [submittedData, setSubmittedData] = React.useState<SubmittedApplicationSuccess | null>(
    null,
  );
  const [referenceCopied, setReferenceCopied] = React.useState(false);

  // Expiry check
  const isExpired = job.closingDate ? new Date(job.closingDate) < new Date() : false;
  const canApply = job.allowApplications && !isExpired;

  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full name is required (minimum 2 characters)';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    // Indian phone: strip spaces/dashes/+91 and check 10 digits starting with 6-9
    const cleanPhone = phone
      .replace(/[\s\-()]/g, '')
      .replace(/^\+91/, '')
      .replace(/^0/, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      errors.phone = 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210)';
    }

    if (!city.trim() || city.trim().length < 2) {
      errors.city = 'Current city is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};

    if (!uploadedResume) {
      errors.resume = 'Please upload your resume in PDF format';
    }

    if (!consentGiven) {
      errors.consent = 'You must confirm and consent before submitting';
    }

    // Validate dynamic required questions
    if (job.questions) {
      job.questions.forEach((q: JobQuestionDto) => {
        const val = answers[q.id];
        if (q.required) {
          if (
            val === undefined ||
            val === null ||
            val === '' ||
            (Array.isArray(val) && val.length === 0)
          ) {
            errors[`q_${q.id}`] = 'This question is required';
          }
        }

        if (val !== undefined && val !== null && val !== '') {
          if (q.fieldType === 'SHORT_TEXT' || q.fieldType === 'LONG_TEXT') {
            const max = q.validation?.maxLength;
            if (max && typeof val === 'string' && val.length > max) {
              errors[`q_${q.id}`] = `Maximum length is ${max} characters`;
            }
          } else if (q.fieldType === 'NUMBER' && typeof val === 'number') {
            const min = q.validation?.min;
            const max = q.validation?.max;
            if (min !== null && min !== undefined && val < min) {
              errors[`q_${q.id}`] = `Value cannot be less than ${min}`;
            }
            if (max !== null && max !== undefined && val > max) {
              errors[`q_${q.id}`] = `Value cannot exceed ${max}`;
            }
          }
        }
      });
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (validateStep1()) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateStep2()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const formattedAnswers = Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        value,
      }));

      const payload = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        currentCity: city.trim(),
        resumeAssetId: uploadedResume!.assetId,
        resumeFileName: uploadedResume!.fileName,
        resumeFileSize: uploadedResume!.fileSize,
        consentGiven: true,
        answers: formattedAnswers,
      };

      const result = await apiRequest<{
        id: string;
        referenceId: string;
        fullName: string;
        email: string;
        status: string;
        createdAt: string;
      }>(`/careers/${job.jobId}/apply`, {
        method: 'POST',
        body: payload,
      });

      setSubmittedData({
        referenceId: result.referenceId,
        jobId: job.jobId,
        fullName: result.fullName,
        email: result.email,
        submittedAt: result.createdAt,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const apiErr = err as {
        code?: string;
        status?: number;
        message?: string;
        fieldErrors?: Record<string, string>;
      };
      if (apiErr?.code === 'CONFLICT' || apiErr?.status === 409) {
        setGeneralError('You have already applied for this position.');
      } else if (apiErr?.code === 'VALIDATION_ERROR' || apiErr?.status === 422) {
        if (apiErr.fieldErrors && Object.keys(apiErr.fieldErrors).length > 0) {
          setFieldErrors(apiErr.fieldErrors);
          setGeneralError('Please review and correct the errors highlighted in the form.');
        } else {
          setGeneralError(
            apiErr.message || 'Validation failed. Please verify all required answers.',
          );
        }
      } else {
        setGeneralError(
          apiErr?.message ||
            'An error occurred while submitting your application. Please try again.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyReferenceId = () => {
    if (submittedData?.referenceId && typeof window !== 'undefined') {
      navigator.clipboard.writeText(submittedData.referenceId);
      setReferenceCopied(true);
      setTimeout(() => setReferenceCopied(false), 2500);
    }
  };

  // ----------------------------------------------------
  // SUBMISSION SUCCESS VIEW
  // ----------------------------------------------------
  if (submittedData) {
    return (
      <div className="bg-muted/20 py-12 sm:py-20">
        <Container className="max-w-2xl">
          <Card className="overflow-hidden border shadow-lg">
            <div className="bg-emerald-600 px-6 py-8 text-center text-white">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Application Received!</h1>
              <p className="mt-1 text-sm text-emerald-100">
                Thank you for applying to ASRA Academy.
              </p>
            </div>

            <CardContent className="space-y-6 p-6 sm:p-8">
              {/* Reference ID Callout */}
              <div className="border-asra-gold-400 dark:bg-asra-gold-950/30 rounded-xl border-2 border-dashed bg-asra-gold-50/60 p-5 text-center">
                <span className="dark:text-asra-gold-300 text-xs font-bold tracking-wider text-asra-gold-800 uppercase">
                  Your Application Reference Number
                </span>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="font-mono text-2xl font-extrabold text-foreground sm:text-3xl">
                    {submittedData.referenceId}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={copyReferenceId}
                    title="Copy reference number"
                    className="h-8 w-8 p-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {referenceCopied && (
                  <p className="mt-1 text-xs font-medium text-emerald-600">Copied to clipboard!</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Please keep this reference number for all future correspondence.
                </p>
              </div>

              {/* Details table */}
              <div className="divide-y rounded-lg border bg-card text-sm">
                <div className="flex justify-between p-3.5">
                  <span className="text-muted-foreground">Candidate Name:</span>
                  <span className="font-medium text-foreground">{submittedData.fullName}</span>
                </div>
                <div className="flex justify-between p-3.5">
                  <span className="text-muted-foreground">Position Applied:</span>
                  <span className="text-right font-medium text-foreground">{job.title}</span>
                </div>
                <div className="flex justify-between p-3.5">
                  <span className="text-muted-foreground">Job ID:</span>
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {submittedData.jobId}
                  </span>
                </div>
                <div className="flex justify-between p-3.5">
                  <span className="text-muted-foreground">Confirmation Dispatched To:</span>
                  <span className="font-medium text-foreground">{submittedData.email}</span>
                </div>
              </div>

              {/* Recruitment Process & Timeline */}
              <div className="space-y-3 rounded-lg bg-muted/40 p-5 text-xs leading-relaxed text-muted-foreground">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Mail className="h-4 w-4 text-primary" /> What happens next?
                </div>
                <p>
                  1. <strong>Email Confirmation:</strong> We have dispatched an official
                  acknowledgement to{' '}
                  <span className="font-medium text-foreground">{submittedData.email}</span>.
                </p>
                <p>
                  2. <strong>Hiring Committee Review:</strong> Our academic leadership and
                  department committee review candidate qualifications on a rolling basis.
                </p>
                <p>
                  3. <strong>Direct Email Communication:</strong> If your background matches our
                  requirements, you will receive an interview invitation or status update directly
                  via email.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 border-t bg-muted/10 p-6 sm:flex-row">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={`/careers/${job.jobId}`}>View Position Details</Link>
              </Button>
              <Button asChild className="ml-auto w-full sm:w-auto">
                <Link href="/careers">Explore Other Openings</Link>
              </Button>
            </CardFooter>
          </Card>
        </Container>
      </div>
    );
  }

  // ----------------------------------------------------
  // CLOSED / INACTIVE STATE
  // ----------------------------------------------------
  if (!canApply) {
    return (
      <div className="bg-muted/20 py-12 sm:py-20">
        <Container className="max-w-xl">
          <Card className="border p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Applications Are Closed</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isExpired
                ? 'The application deadline for this position has passed. Applications are no longer accepted.'
                : 'This role is currently not accepting applications.'}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link href={`/careers/${job.jobId}`}>Back to Job Details</Link>
              </Button>
              <Button asChild>
                <Link href="/careers">Browse Open Positions</Link>
              </Button>
            </div>
          </Card>
        </Container>
      </div>
    );
  }

  // ----------------------------------------------------
  // ACTIVE APPLICATION FORM
  // ----------------------------------------------------
  return (
    <div className="bg-muted/20 py-10 sm:py-16">
      <Container className="max-w-3xl">
        {/* Navigation & Title */}
        <div className="mb-6 space-y-2">
          <Link
            href={`/careers/${job.jobId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {job.title}
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div>
              <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
                Apply for {job.title}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {job.department} • Job ID: {job.jobId}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full font-bold ${
                  step === 1 ? 'bg-primary text-primary-foreground' : 'bg-emerald-600 text-white'
                }`}
              >
                1
              </span>
              <span
                className={`font-medium ${step === 1 ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                Personal Info
              </span>
              <span className="text-muted-foreground">→</span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full font-bold ${
                  step === 2
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                2
              </span>
              <span
                className={`font-medium ${step === 2 ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                Resume & Screening
              </span>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {generalError && (
          <Alert tone="error" title="Notice" className="mb-6">
            {generalError}
          </Alert>
        )}

        <Card className="border shadow-md">
          {/* STEP 1: PERSONAL INFORMATION */}
          {step === 1 && (
            <form onSubmit={handleNext}>
              <CardHeader className="border-b bg-card">
                <CardTitle className="text-lg">Step 1: Personal Details</CardTitle>
                <CardDescription>
                  Please provide your contact information. All recruitment communications will be
                  delivered to this email.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-6 sm:p-8">
                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">
                    Full Legal Name <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="e.g. Dr. Aisha Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-9"
                      aria-invalid={!!fieldErrors.fullName}
                    />
                  </div>
                  {fieldErrors.fullName && (
                    <p className="text-xs font-medium text-destructive">{fieldErrors.fullName}</p>
                  )}
                </div>

                {/* Email Address */}
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="e.g. aisha.sharma@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      aria-invalid={!!fieldErrors.email}
                    />
                  </div>
                  {fieldErrors.email ? (
                    <p className="text-xs font-medium text-destructive">{fieldErrors.email}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Important: Double check your email address. Interview schedules and decisions
                      will be sent here.
                    </p>
                  )}
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Mobile Phone (India +91) <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <span className="flex items-center rounded-md border bg-muted px-3 text-sm font-medium text-muted-foreground">
                      +91
                    </span>
                    <div className="relative flex-1">
                      <Phone className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        maxLength={14}
                        placeholder="9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-9"
                        aria-invalid={!!fieldErrors.phone}
                      />
                    </div>
                  </div>
                  {fieldErrors.phone ? (
                    <p className="text-xs font-medium text-destructive">{fieldErrors.phone}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      10-digit Indian mobile number for interview coordinator contacts.
                    </p>
                  )}
                </div>

                {/* Current City */}
                <div className="space-y-2">
                  <Label htmlFor="city">
                    Current City & State <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="city"
                    type="text"
                    placeholder="e.g. Lucknow, Uttar Pradesh"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    aria-invalid={!!fieldErrors.city}
                  />
                  {fieldErrors.city && (
                    <p className="text-xs font-medium text-destructive">{fieldErrors.city}</p>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex justify-between border-t bg-muted/10 p-6">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/careers/${job.jobId}`}>Cancel</Link>
                </Button>
                <Button type="submit" size="default">
                  Continue to Resume & Screening <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </form>
          )}

          {/* STEP 2: RESUME UPLOAD & DYNAMIC QUESTIONS */}
          {step === 2 && (
            <form onSubmit={handleSubmit}>
              <CardHeader className="border-b bg-card">
                <CardTitle className="text-lg">Step 2: Resume & Screening Questions</CardTitle>
                <CardDescription>
                  Upload your curriculum vitae and answer questions specific to the {job.title}{' '}
                  role.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-6 sm:p-8">
                {/* Resume Upload Box */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label className="text-sm font-semibold">
                      Curriculum Vitae / Resume (PDF) <span className="text-destructive">*</span>
                    </Label>
                    <span className="text-xs text-muted-foreground">Max 5 MB</span>
                  </div>

                  <ResumeUploader
                    currentResume={uploadedResume}
                    onUploadSuccess={(info) => {
                      setUploadedResume(info);
                      setFieldErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.resume;
                        return copy;
                      });
                    }}
                    onClear={() => setUploadedResume(null)}
                    disabled={isSubmitting}
                  />

                  {fieldErrors.resume && (
                    <p className="mt-1 text-xs font-medium text-destructive">
                      {fieldErrors.resume}
                    </p>
                  )}
                </div>

                {/* Role-specific dynamic questions */}
                {job.questions && job.questions.length > 0 && (
                  <div className="space-y-5 border-t pt-4">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        Role Screening Questions
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Please respond to each question thoroughly.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {job.questions.map((q: JobQuestionDto) => (
                        <DynamicQuestionInput
                          key={q.id}
                          question={q}
                          value={answers[q.id]}
                          error={fieldErrors[`q_${q.id}`]}
                          disabled={isSubmitting}
                          onChange={(val) => {
                            setAnswers((prev) => ({ ...prev, [q.id]: val }));
                            setFieldErrors((prev) => {
                              const copy = { ...prev };
                              delete copy[`q_${q.id}`];
                              return copy;
                            });
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Consent and Privacy Agreement */}
                <div className="space-y-3 border-t pt-6">
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">
                        Data Privacy & Candidate Confidentiality
                      </p>
                      <p>
                        Your application data, resume, and questionnaire responses are stored
                        securely and accessed exclusively by the ASRA Academy recruitment committee.
                        We do not sell or share candidate data with third-party recruiters.
                      </p>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 pt-2">
                    <input
                      type="checkbox"
                      checked={consentGiven}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        setConsentGiven(e.target.checked);
                        if (e.target.checked) {
                          setFieldErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.consent;
                            return copy;
                          });
                        }
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      I declare that all information submitted in this application is true,
                      accurate, and complete. I authorize ASRA Academy to verify the provided
                      credentials and process my personal data for recruitment purposes in
                      accordance with the{' '}
                      <Link
                        href="/privacy-policy"
                        target="_blank"
                        className="text-primary underline"
                      >
                        Privacy Policy
                      </Link>
                      . <span className="text-destructive">*</span>
                    </span>
                  </label>
                  {fieldErrors.consent && (
                    <p className="text-xs font-medium text-destructive">{fieldErrors.consent}</p>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex justify-between border-t bg-muted/10 p-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Personal Details
                </Button>
                <Button type="submit" disabled={isSubmitting} size="lg" className="min-w-[140px]">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </Container>
    </div>
  );
}
