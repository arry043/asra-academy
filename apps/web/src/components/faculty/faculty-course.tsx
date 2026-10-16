'use client';

import type { FacultyCourseDetail, FacultyProfileDto } from '@asra/types';
import { facultyProfileUpdateSchema } from '@asra/validation';
import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  MonitorPlay,
  NotebookPen,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { VisibilityBadge } from '@/components/admin/admin-ui';
import { CurriculumApiBase } from '@/components/admin/curriculum-api';
import { CurriculumEditor } from '@/components/admin/curriculum-editor';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { ApiClientError } from '@/lib/api';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';
import { formatDate, formatDuration } from '@/lib/format';
import { facultyCourseHref, parseCourseTab, type CourseTab } from '@/lib/faculty/portal';
import { courseEyebrow } from '@/lib/student/learning';

import { AssignmentsTable } from './faculty-assessments';
import { LiveClassesPanel } from './faculty-classes';
import { PerformancePanel, StudentsTable } from './faculty-students';
import {
  ErrorPanel,
  LoadingPanel,
  Stat,
  StatusBadge,
  errorMessage,
  useApiResource,
  useFacultyApi,
} from './faculty-ui';

const home = { label: 'Dashboard', href: '/faculty/dashboard' };
const coursesCrumb = { label: 'My courses', href: '/faculty/courses' };

/**
 * One assigned course: overview, the SHARED curriculum editor (pointed at `/faculty`), students,
 * assignments, live classes and performance. Course details, faculty assignment and publication
 * are administrator tasks and are not offered here.
 */
export function FacultyCourseWorkspace({ courseId }: { courseId: string }) {
  const api = useFacultyApi();
  const router = useRouter();
  const tab = parseCourseTab(useSearchParams().get('tab'));
  const path = `/faculty/courses/${courseId}`;
  const course = useApiResource(path, () => api.get<FacultyCourseDetail>(path));

  if (course.error && !course.data) {
    const status = course.error instanceof ApiClientError ? course.error.status : 0;
    const title =
      status === 404 || status === 422
        ? 'Course not found'
        : status === 403
          ? 'Not one of your courses'
          : 'Course';
    return (
      <>
        <PageHeader title={title} breadcrumbs={[home, coursesCrumb, { label: title }]} />
        {status === 403 || status === 404 || status === 422 ? (
          <div className="grid justify-items-start gap-3">
            <p className="type-body text-muted-foreground">
              {status === 403
                ? 'You are not assigned to this course. An administrator manages course assignments.'
                : 'This course does not exist.'}
            </p>
            <Button asChild variant="outline">
              <Link href="/faculty/courses">Back to my courses</Link>
            </Button>
          </div>
        ) : (
          <ErrorPanel message={errorMessage(course.error)} onRetry={course.reload} />
        )}
      </>
    );
  }
  if (!course.data) return <LoadingPanel label="Loading course…" rows={6} />;
  const data = course.data;

  return (
    <>
      <PageHeader
        title={data.title}
        breadcrumbs={[home, coursesCrumb, { label: data.title }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            <VisibilityBadge visibility={data.visibility} />
            {data.isPrimary ? <Badge variant="accent">Primary faculty</Badge> : null}
          </span>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(value) => router.replace(facultyCourseHref(courseId, value as CourseTab))}
      >
        <TabsList aria-label="Course workspace">
          <TabsTrigger value="overview">
            <LayoutDashboard aria-hidden /> Overview
          </TabsTrigger>
          <TabsTrigger value="curriculum">
            <BookOpen aria-hidden /> Curriculum
          </TabsTrigger>
          <TabsTrigger value="students">
            <Users aria-hidden /> Students
          </TabsTrigger>
          <TabsTrigger value="assignments">
            <NotebookPen aria-hidden /> Assignments
          </TabsTrigger>
          <TabsTrigger value="classes">
            <MonitorPlay aria-hidden /> Live classes
          </TabsTrigger>
          <TabsTrigger value="performance">
            <BarChart3 aria-hidden /> Performance
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Overview course={data} />
        </TabsContent>
        <TabsContent value="curriculum">
          <CurriculumApiBase.Provider value="/faculty">
            {data.status === 'PUBLISHED' ? null : (
              <Alert tone="info" title="Not published yet">
                <p>
                  Students can see this course once an administrator publishes it. You can prepare
                  its content now.
                </p>
              </Alert>
            )}
            <CurriculumEditor courseId={courseId} onChanged={course.reload} />
          </CurriculumApiBase.Provider>
        </TabsContent>
        <TabsContent value="students">
          <StudentsTable courseId={courseId} />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsTable courseId={courseId} />
        </TabsContent>
        <TabsContent value="classes">
          <LiveClassesPanel courseId={courseId} />
        </TabsContent>
        <TabsContent value="performance">
          <PerformancePanel courseId={courseId} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Overview({ course }: { course: FacultyCourseDetail }) {
  const eyebrow = courseEyebrow(course);
  return (
    <div className="grid gap-6">
      <section aria-label="Course summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Enrolled students" value={course.activeStudents} icon={<Users />} />
        <Stat
          label="Published lessons"
          value={course.lessons.published}
          icon={<BookOpen />}
          hint={`${course.lessons.draft} draft · ${course.modules} modules · ${course.chapters} chapters`}
        />
        <Stat
          label="Assignments"
          value={course.assignments}
          icon={<NotebookPen />}
          hint={`${course.pendingReviews} awaiting review`}
        />
        <Stat label="Upcoming classes" value={course.upcomingClasses} icon={<MonitorPlay />} />
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="about-heading" className="grid content-start gap-2">
          <h2 id="about-heading" className="type-h3 text-heading">
            About the course
          </h2>
          {eyebrow ? <p className="type-body-sm text-muted-foreground">{eyebrow}</p> : null}
          <p className="type-body whitespace-pre-line">
            {course.description ?? course.summary ?? 'No description yet.'}
          </p>
          <p className="type-caption text-muted-foreground">
            {course.durationMinutes
              ? `${formatDuration(course.durationMinutes)} of learning · `
              : ''}
            Last updated {formatDate(course.updatedAt)}
          </p>
        </section>
        <section aria-labelledby="faculty-heading" className="grid content-start gap-2">
          <h2 id="faculty-heading" className="type-h3 text-heading">
            Faculty
          </h2>
          <ul className="grid gap-2">
            {course.instructors.map((item, index) => (
              <li
                key={`${item.fullName}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2"
              >
                <span className="grid">
                  <span className="type-label text-heading">
                    {item.fullName}
                    {item.isYou ? ' (you)' : ''}
                  </span>
                  {item.designation ? (
                    <span className="type-caption text-muted-foreground">{item.designation}</span>
                  ) : null}
                </span>
                {item.isPrimary ? <Badge variant="accent">Primary</Badge> : null}
              </li>
            ))}
          </ul>
          <p className="type-caption text-muted-foreground">
            Faculty assignments, course details and publication are managed by the academy’s
            administrators.
          </p>
        </section>
      </div>
    </div>
  );
}

// --- Profile --------------------------------------------------------------------------------

export function FacultyProfile() {
  const api = useFacultyApi();
  const profile = useApiResource('/faculty/profile', () =>
    api.get<FacultyProfileDto>('/faculty/profile'),
  );

  if (profile.error && !profile.data) {
    return (
      <>
        <PageHeader title="Profile" breadcrumbs={[home, { label: 'Profile' }]} />
        <ErrorPanel message={errorMessage(profile.error)} onRetry={profile.reload} />
      </>
    );
  }
  if (!profile.data) return <LoadingPanel label="Loading your profile…" rows={6} />;
  const data = profile.data;

  return (
    <>
      <PageHeader
        title="Profile"
        breadcrumbs={[home, { label: 'Profile' }]}
        description={`Faculty member since ${formatDate(data.memberSince)}`}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <ProfileForm key={JSON.stringify(data)} profile={data} onSaved={profile.replace} />
        <aside className="grid gap-4">
          <section
            aria-labelledby="account-heading"
            className="grid gap-2 rounded-xl border bg-card p-5"
          >
            <h2 id="account-heading" className="type-h4 text-heading">
              Managed by the academy
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 type-body-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">{data.email}</dd>
              <dt className="text-muted-foreground">Employee code</dt>
              <dd>{data.employeeCode ?? '—'}</dd>
              <dt className="text-muted-foreground">Designation</dt>
              <dd>{data.designation ?? '—'}</dd>
              <dt className="text-muted-foreground">Public profile</dt>
              <dd>{data.isPublic ? 'Shown on the website' : 'Not public'}</dd>
            </dl>
          </section>
          <section
            aria-labelledby="allocation-heading"
            className="grid gap-2 rounded-xl border bg-card p-5"
          >
            <h2 id="allocation-heading" className="type-h4 text-heading">
              Subjects and courses
            </h2>
            {data.courses.length === 0 ? (
              <p className="type-body-sm text-muted-foreground">
                No courses are assigned to you yet.
              </p>
            ) : (
              <>
                {data.subjects.length > 0 ? (
                  <p className="flex flex-wrap gap-1.5">
                    {data.subjects.map((subject) => (
                      <Badge key={subject.slug} variant="outline">
                        {subject.name}
                      </Badge>
                    ))}
                  </p>
                ) : null}
                <ul className="grid gap-1 type-body-sm">
                  {data.courses.map((course) => (
                    <li key={course.id} className="flex flex-wrap items-center gap-2">
                      <Link
                        href={facultyCourseHref(course.id)}
                        className="rounded-sm text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {course.title}
                      </Link>
                      {course.isPrimary ? <Badge variant="accent">Primary</Badge> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="type-caption text-muted-foreground">
              Subjects follow from the courses an administrator assigns to you.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: FacultyProfileDto;
  onSaved: (data: FacultyProfileDto) => void;
}) {
  const api = useFacultyApi();
  const [fullName, setFullName] = React.useState(profile.fullName);
  const [phone, setPhone] = React.useState(profile.phone ?? '');
  const [qualifications, setQualifications] = React.useState(profile.qualifications ?? '');
  const [specialization, setSpecialization] = React.useState(profile.specialization ?? '');
  const [experience, setExperience] = React.useState(
    profile.experienceYears === null ? '' : String(profile.experienceYears),
  );
  const [bio, setBio] = React.useState(profile.bio ?? '');
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = validateForm(facultyProfileUpdateSchema, {
      fullName,
      phone,
      qualifications,
      specialization,
      bio,
      experienceYears: experience.trim() === '' ? null : Number(experience),
    });
    setFormError(null);
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    setPending(true);
    try {
      onSaved(await api.patch<FacultyProfileDto>('/faculty/profile', parsed.data));
      toast.success('Profile saved');
    } catch (error) {
      const described = describeError(error);
      setErrors(described.fieldErrors);
      setFormError(described.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby="profile-heading"
      className="grid gap-4 rounded-xl border bg-card p-5 shadow-card"
    >
      <h2 id="profile-heading" className="type-h4 text-heading">
        Your details
      </h2>
      {formError ? (
        <Alert tone="error">
          <p>{formError}</p>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="profile-name" label="Full name" error={errors.fullName}>
          <Input value={fullName} maxLength={150} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field id="profile-phone" label="Phone" optional error={errors.phone}>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field
          id="profile-qualifications"
          label="Qualifications"
          optional
          error={errors.qualifications}
        >
          <Input
            value={qualifications}
            maxLength={500}
            onChange={(e) => setQualifications(e.target.value)}
          />
        </Field>
        <Field
          id="profile-specialization"
          label="Specialisation"
          optional
          error={errors.specialization}
        >
          <Input
            value={specialization}
            maxLength={255}
            onChange={(e) => setSpecialization(e.target.value)}
          />
        </Field>
        <Field
          id="profile-experience"
          label="Teaching experience (years)"
          optional
          error={errors.experienceYears}
        >
          <Input
            type="number"
            min={0}
            max={70}
            inputMode="numeric"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
          />
        </Field>
      </div>
      <Field
        id="profile-bio"
        label="Short bio"
        optional
        error={errors.bio}
        hint={
          profile.isPublic
            ? 'Your profile is public: changes appear on the website.'
            : 'Not shown publicly unless the academy makes your profile public.'
        }
      >
        <Textarea value={bio} rows={4} onChange={(e) => setBio(e.target.value)} />
      </Field>
      <div>
        <Button type="submit" loading={pending} loadingText="Saving…">
          Save profile
        </Button>
      </div>
    </form>
  );
}
