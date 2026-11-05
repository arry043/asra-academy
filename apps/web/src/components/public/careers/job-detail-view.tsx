'use client';

import type { PublicJobDetailDto } from '@asra/types';
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle,
  Clock,
  GraduationCap,
  HelpCircle,
  MapPin,
  Share2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Container } from '@/components/layout/container';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface JobDetailViewProps {
  job: PublicJobDetailDto;
}

export function JobDetailView({ job }: JobDetailViewProps) {
  const [copied, setCopied] = React.useState(false);

  const formatEmploymentType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatSalary = () => {
    if (!job.isSalaryPublic || (!job.salaryMin && !job.salaryMax)) return null;
    const curr = job.currency || 'INR';
    if (job.salaryMin && job.salaryMax) {
      return `${curr} ${job.salaryMin.toLocaleString('en-IN')} – ${job.salaryMax.toLocaleString('en-IN')}`;
    }
    if (job.salaryMin) return `From ${curr} ${job.salaryMin.toLocaleString('en-IN')}`;
    if (job.salaryMax) return `Up to ${curr} ${job.salaryMax.toLocaleString('en-IN')}`;
    return null;
  };

  const splitTextLines = (text?: string | null): string[] => {
    if (!text) return [];
    return text
      .split('\n')
      .map((l) => l.trim().replace(/^[-*•]\s*/, ''))
      .filter(Boolean);
  };

  const salaryDisplay = formatSalary();

  const isExpired = job.closingDate ? new Date(job.closingDate) < new Date() : false;
  const canApply = job.allowApplications && !isExpired;

  const responsibilitiesList = splitTextLines(job.responsibilities);
  const requiredSkillsList = splitTextLines(job.requiredSkills);
  const preferredSkillsList = splitTextLines(job.preferredSkills);
  const requiredQualificationsList = splitTextLines(job.requiredQualifications);

  const copyJobLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="bg-muted/20 py-10 sm:py-16">
      <Container>
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/careers"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to all job openings
          </Link>
        </div>

        {/* Application Status Banner */}
        {!canApply && (
          <Alert tone="error" title="Applications Closed" className="mb-8">
            {isExpired
              ? 'The deadline for this position has passed. Applications are no longer being accepted.'
              : 'This position is currently not accepting new applications.'}
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main Content Area */}
          <div className="space-y-8 lg:col-span-2">
            {/* Header Card */}
            <Card className="border shadow-sm">
              <CardContent className="p-6 sm:p-8">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="dark:bg-asra-gold-950 dark:text-asra-gold-300 rounded bg-asra-gold-50 px-2.5 py-1 font-mono text-xs font-semibold text-asra-gold-700">
                      {job.jobId}
                    </span>
                    <Badge variant="outline">{job.department}</Badge>
                    <Badge variant="secondary">{job.category}</Badge>
                    <Badge variant="outline">{formatEmploymentType(job.employmentType)}</Badge>
                    {job.workArrangement && (
                      <Badge variant="outline">{job.workArrangement.replace('_', ' ')}</Badge>
                    )}
                  </div>

                  <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
                    {job.title}
                  </h1>

                  {job.shortDescription && (
                    <p className="text-base leading-relaxed text-muted-foreground">
                      {job.shortDescription}
                    </p>
                  )}

                  {/* Summary row */}
                  <div className="grid grid-cols-2 gap-4 border-t pt-4 text-sm sm:grid-cols-4">
                    <div>
                      <span className="block text-xs text-muted-foreground">Location</span>
                      <span className="mt-0.5 flex items-center gap-1 font-medium text-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary" /> {job.workLocation}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-muted-foreground">Experience</span>
                      <span className="mt-0.5 flex items-center gap-1 font-medium text-foreground">
                        <GraduationCap className="h-3.5 w-3.5 text-primary" />{' '}
                        {job.experienceRequired || 'Not specified'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-muted-foreground">Vacancies</span>
                      <span className="mt-0.5 flex items-center gap-1 font-medium text-foreground">
                        <Users className="h-3.5 w-3.5 text-primary" /> {job.vacancies ?? 'Multiple'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-muted-foreground">Deadline</span>
                      <span className="mt-0.5 flex items-center gap-1 font-medium text-foreground">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        {job.closingDate
                          ? new Date(job.closingDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Rolling'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Full Job Description */}
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">About the Role</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm leading-relaxed text-foreground">
                <div className="whitespace-pre-line text-muted-foreground">{job.description}</div>

                {/* Responsibilities */}
                {responsibilitiesList.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="text-base font-semibold text-foreground">
                      Key Responsibilities
                    </h3>
                    <ul className="space-y-2">
                      {responsibilitiesList.map((resp: string, i: number) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{resp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Required Skills & Preferred Skills */}
                {(requiredSkillsList.length > 0 || preferredSkillsList.length > 0) && (
                  <div className="space-y-4 border-t pt-4">
                    {requiredSkillsList.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-base font-semibold text-foreground">
                          Required Skills
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {requiredSkillsList.map((skill: string, i: number) => (
                            <Badge key={i} variant="secondary" className="px-3 py-1 text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {preferredSkillsList.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-foreground">
                          Preferred / Nice to Have
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {preferredSkillsList.map((skill: string, i: number) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="px-3 py-1 text-xs text-muted-foreground"
                            >
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Qualifications */}
                {(job.minQualification || requiredQualificationsList.length > 0) && (
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="text-base font-semibold text-foreground">
                      Qualification Requirements
                    </h3>
                    <div className="space-y-1.5 text-sm">
                      {job.minQualification && (
                        <p>
                          <strong className="text-foreground">Minimum Qualification:</strong>{' '}
                          <span className="text-muted-foreground">{job.minQualification}</span>
                        </p>
                      )}
                      {job.maxQualification && (
                        <p>
                          <strong className="text-foreground">
                            Maximum / Target Qualification:
                          </strong>{' '}
                          <span className="text-muted-foreground">{job.maxQualification}</span>
                        </p>
                      )}
                    </div>

                    {requiredQualificationsList.length > 0 && (
                      <ul className="space-y-2 pt-2">
                        {requiredQualificationsList.map((qual: string, i: number) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-asra-gold-600" />
                            <span>{qual}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Additional Requirements */}
                {job.additionalRequirements && (
                  <div className="space-y-2 border-t pt-4">
                    <h3 className="text-base font-semibold text-foreground">
                      Additional Requirements
                    </h3>
                    <p className="whitespace-pre-line text-muted-foreground">
                      {job.additionalRequirements}
                    </p>
                  </div>
                )}

                {/* Benefits */}
                {job.benefits && (
                  <div className="space-y-2 border-t pt-4">
                    <h3 className="text-base font-semibold text-foreground">What We Offer</h3>
                    <p className="whitespace-pre-line text-muted-foreground">{job.benefits}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Questions preview note */}
            {job.questions && job.questions.length > 0 && (
              <Card className="dark:bg-asra-gold-950/20 border bg-asra-gold-50/50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-asra-gold-600" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-foreground">Screening Questions</h4>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        This application includes {job.questions.length} role-specific screening{' '}
                        {job.questions.length === 1 ? 'question' : 'questions'} to help our hiring
                        committee evaluate your background. You will answer these in the application
                        step.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Quick Apply Card */}
            <Card className="sticky top-24 border shadow-md">
              <CardHeader className="border-b bg-asra-warm-white dark:bg-muted/40">
                <CardTitle className="text-lg">Ready to Apply?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                {salaryDisplay && (
                  <div>
                    <span className="block text-xs text-muted-foreground">Compensation</span>
                    <span className="mt-0.5 flex items-center gap-1 text-lg font-bold text-emerald-600">
                      {salaryDisplay}
                    </span>
                  </div>
                )}

                <div className="space-y-2 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Application takes approximately 5
                    minutes
                  </p>
                  <p className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" /> PDF resume required (max 5 MB)
                  </p>
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" /> Direct email communication on all
                    updates
                  </p>
                </div>

                {canApply ? (
                  <Button asChild size="lg" className="w-full font-semibold">
                    <Link href={`/careers/${job.jobId}/apply`}>Apply for this Position</Link>
                  </Button>
                ) : (
                  <Button disabled size="lg" className="w-full">
                    Applications Closed
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyJobLink}
                  className="w-full text-xs text-muted-foreground hover:text-foreground"
                >
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  {copied ? 'Link Copied to Clipboard!' : 'Share this Position'}
                </Button>
              </CardContent>
            </Card>

            {/* Equal Opportunity Notice */}
            <div className="space-y-2 rounded-lg border bg-card p-5 text-xs text-muted-foreground">
              <h5 className="font-semibold text-foreground">Equal Opportunity Statement</h5>
              <p className="leading-relaxed">
                ASRA Academy is an equal opportunity employer. We value diversity and do not
                discriminate based on race, religion, color, national origin, gender, age, marital
                status, or disability.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
