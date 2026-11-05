'use client';

import type { AdminJobDetailDto, JobQuestionType } from '@asra/types';
import type { AdminCreateJobInput, JobQuestionInput } from '@asra/validation';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { errorMessage, useAdminApi } from '../use-admin';

interface JobFormProps {
  initialJob?: AdminJobDetailDto;
}

export function JobForm({ initialJob }: JobFormProps) {
  const router = useRouter();
  const api = useAdminApi();
  const isEditing = Boolean(initialJob);

  // Form State
  const [title, setTitle] = React.useState(initialJob?.title ?? '');
  const [department, setDepartment] = React.useState(initialJob?.department ?? 'Academics');
  const [category, setCategory] = React.useState(initialJob?.category ?? 'Faculty');
  const [employmentType, setEmploymentType] = React.useState(
    initialJob?.employmentType ?? 'Full-time',
  );
  const [workLocation, setWorkLocation] = React.useState(initialJob?.workLocation ?? 'Hyderabad');
  const [workArrangement, setWorkArrangement] = React.useState(
    initialJob?.workArrangement ?? 'On-site',
  );
  const [vacancies, setVacancies] = React.useState(initialJob?.vacancies?.toString() ?? '1');
  const [experienceRequired, setExperienceRequired] = React.useState(
    initialJob?.experienceRequired ?? '2+ years',
  );
  const [minQualification, setMinQualification] = React.useState(
    initialJob?.minQualification ?? "Master's Degree",
  );
  const [maxQualification, setMaxQualification] = React.useState(
    initialJob?.maxQualification ?? 'Ph.D. / Equivalent',
  );
  const [salaryMin, setSalaryMin] = React.useState(initialJob?.salaryMin?.toString() ?? '');
  const [salaryMax, setSalaryMax] = React.useState(initialJob?.salaryMax?.toString() ?? '');
  const currency = initialJob?.currency ?? 'INR';
  const [isSalaryPublic, setIsSalaryPublic] = React.useState(initialJob?.isSalaryPublic ?? false);

  const [shortDescription, setShortDescription] = React.useState(
    initialJob?.shortDescription ?? '',
  );
  const [description, setDescription] = React.useState(initialJob?.description ?? '');
  const [responsibilities, setResponsibilities] = React.useState(
    initialJob?.responsibilities ?? '',
  );
  const [requiredSkills, setRequiredSkills] = React.useState(initialJob?.requiredSkills ?? '');
  const [preferredSkills, setPreferredSkills] = React.useState(initialJob?.preferredSkills ?? '');
  const [requiredQualifications, setRequiredQualifications] = React.useState(
    initialJob?.requiredQualifications ?? '',
  );
  const [additionalRequirements, setAdditionalRequirements] = React.useState(
    initialJob?.additionalRequirements ?? '',
  );
  const [benefits, setBenefits] = React.useState(initialJob?.benefits ?? '');

  const [status, setStatus] = React.useState<'DRAFT' | 'PUBLISHED'>(
    initialJob?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
  );
  const [openingDate, setOpeningDate] = React.useState(
    initialJob?.openingDate ? initialJob.openingDate.split('T')[0] : '',
  );
  const [closingDate, setClosingDate] = React.useState(
    initialJob?.closingDate ? initialJob.closingDate.split('T')[0] : '',
  );
  const [allowApplications, setAllowApplications] = React.useState(
    initialJob?.allowApplications ?? true,
  );

  // Dynamic Questions State
  const [questions, setQuestions] = React.useState<JobQuestionInput[]>(
    initialJob?.questions.map((q) => ({
      id: q.id,
      label: q.label,
      helpText: q.helpText ?? '',
      fieldType: q.fieldType,
      required: q.required,
      options: q.options ?? [],
      displayOrder: q.displayOrder,
      validation: q.validation ?? null,
    })) ?? [],
  );

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        label: '',
        helpText: '',
        fieldType: 'SHORT_TEXT',
        required: false,
        options: [],
        displayOrder: questions.length,
        validation: null,
      },
    ]);
  };

  const updateQuestion = (index: number, updates: Partial<JobQuestionInput>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index]!, ...updates };
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...questions];
    const temp = updated[index]!;
    updated[index] = updated[targetIndex]!;
    updated[targetIndex] = temp;
    // Update display orders
    updated.forEach((q, i) => {
      q.displayOrder = i;
    });
    setQuestions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});

    try {
      const payload: AdminCreateJobInput = {
        title: title.trim(),
        department: department.trim(),
        category: category.trim(),
        employmentType: employmentType as AdminCreateJobInput['employmentType'],
        workLocation: workLocation.trim(),
        workArrangement: workArrangement as AdminCreateJobInput['workArrangement'],
        vacancies: vacancies ? parseInt(vacancies, 10) : null,
        experienceRequired: experienceRequired.trim() || null,
        minQualification: minQualification.trim() || null,
        maxQualification: maxQualification.trim() || null,
        salaryMin: salaryMin ? parseInt(salaryMin, 10) : null,
        salaryMax: salaryMax ? parseInt(salaryMax, 10) : null,
        currency,
        isSalaryPublic,
        shortDescription: shortDescription.trim() || null,
        description: description.trim(),
        responsibilities: responsibilities.trim() || null,
        requiredSkills: requiredSkills.trim() || null,
        preferredSkills: preferredSkills.trim() || null,
        requiredQualifications: requiredQualifications.trim() || null,
        additionalRequirements: additionalRequirements.trim() || null,
        benefits: benefits.trim() || null,
        status,
        openingDate: openingDate ? new Date(openingDate).toISOString() : null,
        closingDate: closingDate ? new Date(closingDate).toISOString() : null,
        allowApplications,
        questions: questions.map((q, idx) => ({
          id: q.id,
          label: q.label.trim(),
          helpText: q.helpText?.trim() || null,
          fieldType: q.fieldType,
          required: q.required,
          options:
            q.fieldType === 'SINGLE_SELECT' || q.fieldType === 'MULTI_SELECT'
              ? (q.options ?? []).map((o) => o.trim()).filter(Boolean)
              : null,
          displayOrder: idx,
          validation: q.validation ?? null,
        })),
      };

      if (isEditing) {
        await api.put(`/admin/recruitment/jobs/${initialJob!.id}`, payload);
        toast.success('Job Updated', {
          description: `"${payload.title}" has been successfully updated.`,
        });
      } else {
        const created = await api.post<{ id: string; jobId: string }>(
          '/admin/recruitment/jobs',
          payload,
        );
        toast.success('Job Created', {
          description: `Created vacancy with Job ID: ${created.jobId}`,
        });
      }

      router.push('/admin/recruitment/jobs');
      router.refresh();
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'fieldErrors' in err) {
        const withFieldErrors = err as { fieldErrors?: Record<string, string> };
        if (withFieldErrors.fieldErrors) {
          setFieldErrors(withFieldErrors.fieldErrors);
        }
      }
      toast.error('Validation Error', {
        description: errorMessage(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-8">
      {/* Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/admin/recruitment/jobs">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="type-h2 text-heading">
              {isEditing ? `Edit Job: ${initialJob?.jobId}` : 'Create New Job Opening'}
            </h1>
            <p className="type-body text-muted-foreground">
              {isEditing
                ? 'Update role information, description and candidate application questions.'
                : 'Configure role requirements, job description and custom dynamic questions.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/admin/recruitment/jobs">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 size-4" />
            {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Job'}
          </Button>
        </div>
      </div>

      {/* SECTION A: Basic Information */}
      <Card className="grid gap-6 p-6">
        <div>
          <h2 className="type-h3 text-heading">Section A — Basic Role Information</h2>
          <p className="type-caption text-muted-foreground">
            Core job title, classification, department and compensation details.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Job Title" error={fieldErrors.title}>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Faculty — Mathematics (CBSE Class 11 & 12)"
                required
              />
            </Field>
          </div>

          <Field label="Department" error={fieldErrors.department}>
            <Input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Science, Mathematics, Humanities, Administration"
              required
            />
          </Field>

          <Field label="Category" error={fieldErrors.category}>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Faculty, Curriculum Development, Operations"
              required
            />
          </Field>

          <Field label="Employment Type">
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:ring-1 focus:ring-ring"
            >
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
              <option value="Visiting Faculty">Visiting Faculty</option>
            </select>
          </Field>

          <Field label="Work Arrangement">
            <select
              value={workArrangement}
              onChange={(e) => setWorkArrangement(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:ring-1 focus:ring-ring"
            >
              <option value="On-site">On-site</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Remote">Remote</option>
            </select>
          </Field>

          <Field label="Work Location" error={fieldErrors.workLocation}>
            <Input
              value={workLocation}
              onChange={(e) => setWorkLocation(e.target.value)}
              placeholder="e.g. Hyderabad Campus / Bengaluru / Remote"
              required
            />
          </Field>

          <Field label="Vacancies">
            <Input
              type="number"
              min="1"
              max="99"
              value={vacancies}
              onChange={(e) => setVacancies(e.target.value)}
              placeholder="Number of open slots"
            />
          </Field>

          <Field label="Experience Required">
            <Input
              value={experienceRequired}
              onChange={(e) => setExperienceRequired(e.target.value)}
              placeholder="e.g. 3–5 years teaching experience"
            />
          </Field>

          <Field label="Minimum Qualification">
            <Input
              value={minQualification}
              onChange={(e) => setMinQualification(e.target.value)}
              placeholder="e.g. Post-Graduate / M.Sc. in relevant discipline"
            />
          </Field>

          <Field label="Maximum Qualification">
            <Input
              value={maxQualification}
              onChange={(e) => setMaxQualification(e.target.value)}
              placeholder="e.g. Ph.D. / B.Ed. Preferred"
            />
          </Field>

          {/* Salary Grid */}
          <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="type-label text-heading">Compensation & Salary</span>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isSalaryPublic}
                  onChange={(e) => setIsSalaryPublic(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary"
                />
                Display salary range publicly on Careers page
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Minimum Salary (₹ per annum)">
                <Input
                  type="number"
                  min="0"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  placeholder="e.g. 600000"
                />
              </Field>
              <Field label="Maximum Salary (₹ per annum)">
                <Input
                  type="number"
                  min="0"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  placeholder="e.g. 1000000"
                />
              </Field>
              <Field label="Currency">
                <Input value={currency} readOnly disabled />
              </Field>
            </div>
          </div>
        </div>
      </Card>

      {/* SECTION B: Job Description */}
      <Card className="grid gap-6 p-6">
        <div>
          <h2 className="type-h3 text-heading">Section B — Job Description & Requirements</h2>
          <p className="type-caption text-muted-foreground">
            Provide comprehensive details about duties, required skills and academy culture.
          </p>
        </div>

        <Field label="Short Overview / Teaser" error={fieldErrors.shortDescription}>
          <Input
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder="A 1-2 sentence preview displayed on the careers job card listing."
          />
        </Field>

        <Field label="Full Job Description" error={fieldErrors.description}>
          <Textarea
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of the position, academy goals, student age group, and department mission."
            required
          />
        </Field>

        <Field label="Key Responsibilities">
          <Textarea
            rows={4}
            value={responsibilities}
            onChange={(e) => setResponsibilities(e.target.value)}
            placeholder="Bullet points or detailed outline of day-to-day duties, lesson planning, student mentorship, etc."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Required Skills & Competencies">
            <Textarea
              rows={4}
              value={requiredSkills}
              onChange={(e) => setRequiredSkills(e.target.value)}
              placeholder="e.g. CBSE syllabus mastery, interactive classroom management, online presentation skills"
            />
          </Field>

          <Field label="Preferred / Desirable Skills">
            <Textarea
              rows={4}
              value={preferredSkills}
              onChange={(e) => setPreferredSkills(e.target.value)}
              placeholder="e.g. Experience with digital LMS platforms, Olympiad coaching background"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Educational & Professional Qualifications">
            <Textarea
              rows={3}
              value={requiredQualifications}
              onChange={(e) => setRequiredQualifications(e.target.value)}
              placeholder="Mandatory educational background, certifications, and teaching credentials."
            />
          </Field>

          <Field label="Benefits, Perks & Growth">
            <Textarea
              rows={3}
              value={benefits}
              onChange={(e) => setBenefits(e.target.value)}
              placeholder="Health insurance, annual teaching bonus, professional conference allowance, paid leaves."
            />
          </Field>
        </div>

        <Field label="Additional Requirements & Notes (Optional)">
          <Textarea
            rows={3}
            value={additionalRequirements}
            onChange={(e) => setAdditionalRequirements(e.target.value)}
            placeholder="Special background checks, language requirements, or relocation expectations."
          />
        </Field>
      </Card>

      {/* SECTION C: Publication Settings */}
      <Card className="grid gap-6 p-6">
        <div>
          <h2 className="type-h3 text-heading">Section C — Publication & Application Window</h2>
          <p className="type-caption text-muted-foreground">
            Manage visibility, application closing date, and active acceptance.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Publication Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:ring-1 focus:ring-ring"
            >
              <option value="DRAFT">Save as Draft (Private)</option>
              <option value="PUBLISHED">Published (Visible on Careers Page)</option>
            </select>
          </Field>

          <Field label="Opening Date (Optional)">
            <Input
              type="date"
              value={openingDate}
              onChange={(e) => setOpeningDate(e.target.value)}
            />
          </Field>

          <Field label="Closing Date / Deadline (Optional)" error={fieldErrors.closingDate}>
            <Input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="allowApps"
            checked={allowApplications}
            onChange={(e) => setAllowApplications(e.target.checked)}
            className="rounded border-input text-primary focus:ring-primary"
          />
          <label htmlFor="allowApps" className="cursor-pointer type-label text-heading">
            Allow candidate applications online
          </label>
        </div>
      </Card>

      {/* SECTION D: Additional Dynamic Questions Builder */}
      <Card className="grid gap-6 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="type-h3 text-heading">Section D — Job-Specific Application Questions</h2>
            <p className="type-caption text-muted-foreground">
              The base application form asks for Full Name, Email, 10-digit Indian Mobile, City,
              Resume PDF, and Consent. Add job-specific screening questions below.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="mr-1.5 size-4" /> Add Question
          </Button>
        </div>

        {questions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="type-body text-muted-foreground">
              No additional questions configured. Applicants will submit only the standard base
              fields and their PDF resume.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={addQuestion}
            >
              <Plus className="mr-1.5 size-4" /> Add Question
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {questions.map((q, idx) => (
              <div
                key={idx}
                className="grid gap-4 rounded-xl border bg-background/50 p-4 shadow-xs"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="type-label font-medium text-heading">Question #{idx + 1}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={idx === 0}
                      onClick={() => moveQuestion(idx, 'up')}
                      title="Move Up"
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={idx === questions.length - 1}
                      onClick={() => moveQuestion(idx, 'down')}
                      title="Move Down"
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuestion(idx)}
                      title="Delete Question"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Field label="Question Label">
                      <Input
                        value={q.label}
                        onChange={(e) => updateQuestion(idx, { label: e.target.value })}
                        placeholder="e.g. Which classes have you taught in the last 2 years?"
                        required
                      />
                    </Field>
                  </div>

                  <Field label="Field Type">
                    <select
                      value={q.fieldType}
                      onChange={(e) =>
                        updateQuestion(idx, { fieldType: e.target.value as JobQuestionType })
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:ring-1 focus:ring-ring"
                    >
                      <option value="SHORT_TEXT">Short Text (Single line)</option>
                      <option value="LONG_TEXT">Long Text (Paragraph)</option>
                      <option value="SINGLE_SELECT">Single Select (Dropdown / Radio)</option>
                      <option value="MULTI_SELECT">Multi Select (Checkboxes)</option>
                      <option value="YES_NO">Yes / No</option>
                      <option value="NUMBER">Number</option>
                      <option value="DATE">Date</option>
                      <option value="URL">URL / Portfolio Link</option>
                    </select>
                  </Field>

                  <div className="sm:col-span-2">
                    <Field label="Help Text / Placeholder (Optional)">
                      <Input
                        value={q.helpText ?? ''}
                        onChange={(e) => updateQuestion(idx, { helpText: e.target.value })}
                        placeholder="e.g. Include name of schools, boards (CBSE/ICSE) and subjects."
                      />
                    </Field>
                  </div>

                  <div className="flex items-center pt-6">
                    <label className="flex cursor-pointer items-center gap-2 type-label text-heading">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => updateQuestion(idx, { required: e.target.checked })}
                        className="rounded border-input text-primary focus:ring-primary"
                      />
                      Candidate answer is mandatory
                    </label>
                  </div>

                  {/* Options editor for SELECT types */}
                  {(q.fieldType === 'SINGLE_SELECT' || q.fieldType === 'MULTI_SELECT') && (
                    <div className="rounded-lg border bg-muted/20 p-3 sm:col-span-3">
                      <Field
                        label="Options (comma-separated, at least 2)"
                        hint="Enter choices separated by commas, e.g. Class 9, Class 10, Class 11, Class 12"
                      >
                        <Input
                          value={(q.options ?? []).join(', ')}
                          onChange={(e) =>
                            updateQuestion(idx, {
                              options: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Option 1, Option 2, Option 3"
                        />
                      </Field>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-3">
        <Button asChild variant="outline">
          <Link href="/admin/recruitment/jobs">Cancel</Link>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <Save className="mr-2 size-4" />
          {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Job'}
        </Button>
      </div>
    </form>
  );
}
