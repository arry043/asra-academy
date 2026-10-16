'use client';

import type {
  CourseAccessState,
  Paginated,
  StudentCatalogCourse,
  StudentCourseCard,
  StudentCourseOverview,
} from '@asra/types';
import { BookOpen, CheckCircle2, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { ConfirmDialog } from '@/components/admin/admin-ui';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/public/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SearchInput } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { formatDuration } from '@/lib/format';
import { courseEyebrow, courseHref, learnHref } from '@/lib/student/learning';

import {
  cardGrid,
  CourseThumb,
  EnrolledCourseCard,
  ErrorPanel,
  ListPager,
  LoadingPanel,
} from './student-ui';
import { errorMessage, useApiResource, useStudentApi, withPage } from './use-student';

type Tab = 'enrolled' | 'find';

/** `/student/courses`: enrolled courses, and published courses the student can join. */
export function StudentCourses() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = params.get('tab') === 'find' ? 'find' : 'enrolled';

  return (
    <>
      <PageHeader
        title="My courses"
        breadcrumbs={[{ label: 'Dashboard', href: '/student/dashboard' }, { label: 'My courses' }]}
      />
      <Tabs
        value={tab}
        onValueChange={(value) =>
          router.replace(
            value === 'find' ? `${pathname}?tab=find` : (pathname ?? '/student/courses'),
          )
        }
      >
        <TabsList aria-label="Course lists">
          <TabsTrigger value="enrolled">
            <BookOpen aria-hidden /> Enrolled
          </TabsTrigger>
          <TabsTrigger value="find">
            <Search aria-hidden /> Find courses
          </TabsTrigger>
        </TabsList>
        <TabsContent value="enrolled">
          <EnrolledCourses />
        </TabsContent>
        <TabsContent value="find">
          <CourseFinder />
        </TabsContent>
      </Tabs>
    </>
  );
}

function EnrolledCourses() {
  const api = useStudentApi();
  const [page, setPage] = React.useState(1);
  const path = withPage('/student/courses', page, { pageSize: '12' });
  const list = useApiResource(path, () => api.get<Paginated<StudentCourseCard>>(path));

  if (list.error && !list.data) {
    return <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />;
  }
  if (!list.data) return <LoadingPanel label="Loading your courses…" />;
  if (list.data.items.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen />}
        title="You are not enrolled in any course yet"
        description="Free courses can be joined from “Find courses”. For other courses, the academy enrols you after admission."
        action={
          <Button asChild>
            <Link href="/student/courses?tab=find">Find courses</Link>
          </Button>
        }
      />
    );
  }
  return (
    <div className="grid gap-6">
      <div className={cardGrid}>
        {list.data.items.map((course) => (
          <EnrolledCourseCard
            key={course.id}
            course={course}
            progress={course.progress}
            resumeLesson={course.resumeLesson}
            lastActivityAt={course.enrollment.lastActivityAt}
            headingLevel="h2"
          />
        ))}
      </div>
      <ListPager pagination={list.data.pagination} onPageChange={setPage} label="Course pages" />
    </div>
  );
}

const ACCESS_BADGE: Record<
  CourseAccessState,
  { label: string; variant: 'success' | 'info' | 'secondary' }
> = {
  ENROLLED: { label: 'Enrolled', variant: 'success' },
  FREE_ENROLMENT: { label: 'Free', variant: 'info' },
  CONTACT_ACADEMY: { label: 'Enrolment by the academy', variant: 'secondary' },
};

function CourseFinder() {
  const api = useStudentApi();
  const [page, setPage] = React.useState(1);
  const [query, setQuery] = React.useState('');
  const [submitted, setSubmitted] = React.useState('');
  const path = withPage('/student/catalog', page, {
    pageSize: '12',
    ...(submitted ? { q: submitted } : {}),
  });
  const list = useApiResource(path, () => api.get<Paginated<StudentCatalogCourse>>(path));

  return (
    <div className="grid gap-6">
      <form
        role="search"
        className="flex max-w-xl gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSubmitted(query.trim());
        }}
      >
        <label htmlFor="course-search" className="sr-only">
          Search courses
        </label>
        <SearchInput
          id="course-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by course or subject"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      {list.error && !list.data ? (
        <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingPanel label="Loading courses…" />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title={submitted ? 'No matching courses' : 'No courses are published yet'}
          description={submitted ? 'Try a different search.' : 'Please check back later.'}
        />
      ) : (
        <>
          <div className={cardGrid}>
            {list.data.items.map((course) => (
              <CatalogCard key={course.id} course={course} onEnrolled={list.reload} />
            ))}
          </div>
          <ListPager
            pagination={list.data.pagination}
            onPageChange={setPage}
            label="Catalogue pages"
          />
        </>
      )}
    </div>
  );
}

function CatalogCard({
  course,
  onEnrolled,
}: {
  course: StudentCatalogCourse;
  onEnrolled: () => void;
}) {
  const eyebrow = courseEyebrow(course);
  const badge = ACCESS_BADGE[course.access];
  const duration = formatDuration(course.durationMinutes);
  return (
    <Card className="h-full gap-4 overflow-hidden pt-0 sm:pt-0">
      <CourseThumb course={course} />
      <CardHeader className="gap-2">
        <div className="flex flex-wrap gap-2">
          {eyebrow ? <Badge variant="accent">{eyebrow}</Badge> : null}
          <Badge variant={badge.variant}>
            {course.access === 'ENROLLED' ? <CheckCircle2 aria-hidden /> : null}
            {badge.label}
          </Badge>
        </div>
        <CardTitle as="h2" className="line-clamp-2">
          {course.title}
        </CardTitle>
        {course.summary ? (
          <CardDescription className="line-clamp-3">{course.summary}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="mt-auto type-body-sm text-muted-foreground">
        {[duration ? `About ${duration} of learning` : null, course.instructors[0]?.fullName]
          .filter(Boolean)
          .join(' · ')}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {course.access === 'FREE_ENROLMENT' ? (
          <EnrolButton courseId={course.id} title={course.title} onEnrolled={onEnrolled} />
        ) : null}
        <Button asChild size="sm" variant="outline">
          <Link href={courseHref(course.id)}>
            {course.access === 'ENROLLED' ? 'Open course' : 'View details'}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

/** Free self-enrolment with a confirmation; the API re-checks that the course is free. */
export function EnrolButton({
  courseId,
  title,
  onEnrolled,
  size = 'sm',
}: {
  courseId: string;
  title: string;
  onEnrolled: (course: StudentCourseOverview) => void;
  size?: 'sm' | 'default';
}) {
  const api = useStudentApi();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        Enrol for free
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title="Enrol in this course?"
        description={`“${title}” is free. It will be added to your courses and your progress will be saved.`}
        confirmLabel="Enrol"
        pendingLabel="Enrolling…"
        onConfirm={async () => {
          try {
            const course = await api.post<StudentCourseOverview>(
              `/student/courses/${courseId}/enroll`,
            );
            toast.success('You are enrolled', { description: title });
            onEnrolled(course);
            router.push(
              course.resumeLesson
                ? learnHref(courseId, course.resumeLesson.lessonId)
                : courseHref(courseId),
            );
          } catch (caught) {
            setError(errorMessage(caught));
            throw caught;
          }
        }}
      >
        {error ? (
          <p role="alert" className="type-body-sm text-destructive">
            {error}
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
