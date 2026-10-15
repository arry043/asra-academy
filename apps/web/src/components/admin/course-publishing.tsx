'use client';

import type { AdminCourseDetail } from '@asra/types';
import {
  Archive,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  RotateCcw,
  Rocket,
  Trash2,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { formatDiscount, formatMoney, VISIBILITY_OPTIONS } from '@/lib/admin/format';
import { ApiClientError } from '@/lib/api';
import { formatDateTime, formatDuration } from '@/lib/format';

import { ConfirmDialog, StatusBadge, VisibilityBadge } from './admin-ui';
import { errorMessage, useAdminApi } from './use-admin';

type Action = 'publish' | 'unpublish' | 'archive' | 'restore' | 'delete';

const ACTIONS: Record<
  Action,
  { title: string; confirm: string; pending: string; done: string; destructive?: boolean }
> = {
  publish: {
    title: 'Publish this course?',
    confirm: 'Publish',
    pending: 'Publishing…',
    done: 'Course published',
  },
  unpublish: {
    title: 'Unpublish this course?',
    confirm: 'Unpublish',
    pending: 'Unpublishing…',
    done: 'Course unpublished',
    destructive: true,
  },
  archive: {
    title: 'Archive this course?',
    confirm: 'Archive',
    pending: 'Archiving…',
    done: 'Course archived',
  },
  restore: {
    title: 'Restore to draft?',
    confirm: 'Restore',
    pending: 'Restoring…',
    done: 'Course restored to draft',
  },
  delete: {
    title: 'Delete this course?',
    confirm: 'Delete',
    pending: 'Deleting…',
    done: 'Course deleted',
    destructive: true,
  },
};

function describeAction(action: Action, course: AdminCourseDetail): string {
  switch (action) {
    case 'publish':
      return course.visibility === 'PRIVATE'
        ? 'The course becomes published, but its visibility is Private, so it will not appear on the public website.'
        : course.visibility === 'UNLISTED'
          ? 'The course page becomes reachable by its link (it is not listed in the catalogue).'
          : 'The course appears in the public catalogue and its page becomes visible to everyone.';
    case 'unpublish':
      return 'The course is removed from the public website immediately and returns to draft. Its curriculum is kept.';
    case 'archive':
      return 'Archived courses are kept for reference but cannot be published until restored.';
    case 'restore':
      return 'The course returns to draft so it can be edited and published again.';
    case 'delete':
      return 'This permanently deletes the course. Only draft or archived courses without curriculum can be deleted.';
  }
}

/** Status, publication checklist and lifecycle actions. The UI changes only after the API confirms. */
export function PublishingPanel({
  course,
  onChanged,
  onShowTab,
}: {
  course: AdminCourseDetail;
  onChanged: (course: AdminCourseDetail) => void;
  onShowTab: (tab: string) => void;
}) {
  const api = useAdminApi();
  const router = useRouter();
  const [action, setAction] = React.useState<Action | null>(null);
  const [serverIssues, setServerIssues] = React.useState<string[]>([]);

  async function run(kind: Action) {
    setServerIssues([]);
    try {
      if (kind === 'delete') {
        await api.del(`/admin/courses/${course.id}`);
        toast.success(ACTIONS.delete.done, { description: course.title });
        router.push('/admin/courses');
        return;
      }
      const updated = await api.post<AdminCourseDetail>(`/admin/courses/${course.id}/${kind}`, {
        expectedUpdatedAt: course.updatedAt,
      });
      toast.success(ACTIONS[kind].done, { description: updated.title });
      onChanged(updated);
    } catch (error) {
      if (error instanceof ApiClientError && Array.isArray(error.details)) {
        setServerIssues(
          (error.details as { message?: string }[])
            .map((issue) => issue.message ?? '')
            .filter(Boolean),
        );
      }
      toast.error(`Could not ${kind} the course`, {
        description:
          error instanceof ApiClientError && error.code === 'CONFLICT'
            ? `${error.message} If someone else changed it, reload the page.`
            : errorMessage(error),
      });
      throw error;
    }
  }

  const { publication, counts } = course;
  const isPublished = course.status === 'PUBLISHED';
  const publicHref = `/courses/${course.slug}`;
  const price = formatMoney(course.priceMinor, course.currency);
  const discount = formatDiscount(course.discountType, course.discountValue, course.currency);

  const facts: [string, React.ReactNode][] = [
    ['Status', <StatusBadge key="s" status={course.status} />],
    ['Visibility', <VisibilityBadge key="v" visibility={course.visibility} />],
    ['Published', formatDateTime(course.publishedAt) ?? '—'],
    ['Last updated', formatDateTime(course.updatedAt)],
    ['Learning time', formatDuration(course.durationMinutes) ?? 'Not set'],
    ['Price', price ? `${price}${discount ? ` (${discount})` : ''}` : 'Not set'],
    [
      'Curriculum',
      `${counts.modules} modules · ${counts.chapters} chapters · ${counts.lessons} lessons (${counts.publishedLessons} published) · ${counts.resources} resources`,
    ],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section
        className="grid content-start gap-4 rounded-xl border bg-card p-5 shadow-card"
        aria-labelledby="publication-title"
      >
        <div className="grid gap-1">
          <h2 id="publication-title" className="type-h4 text-heading">
            Publication checklist
          </h2>
          <p className="type-body-sm text-muted-foreground">
            A course can be published when every requirement is met. Visibility decides who can see
            it once published.
          </p>
        </div>

        {publication.eligible ? (
          <Alert tone="success" title={isPublished ? 'Live and complete' : 'Ready to publish'}>
            <p>All publication requirements are met.</p>
          </Alert>
        ) : (
          <ul className="grid gap-2" aria-label="Unmet requirements">
            {publication.issues.map((issue) => (
              <li
                key={`${issue.code}-${issue.path.join('.')}`}
                className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-soft px-3 py-2 type-body-sm text-warning"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="grid gap-1">
                  <span>{issue.message}</span>
                  <button
                    type="button"
                    className="w-fit cursor-pointer font-semibold underline underline-offset-2"
                    onClick={() =>
                      onShowTab(
                        issue.path[0] === 'curriculum'
                          ? 'curriculum'
                          : issue.path[0] === 'instructors'
                            ? 'faculty'
                            : 'details',
                      )
                    }
                  >
                    Fix this
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {serverIssues.length > 0 ? (
          <Alert tone="error" title="The server refused the change">
            <ul className="list-disc pl-4">
              {serverIssues.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          {course.status === 'DRAFT' ? (
            <Button
              onClick={() => setAction('publish')}
              disabled={!publication.eligible}
              title={publication.eligible ? undefined : 'Complete the checklist first'}
            >
              <Rocket aria-hidden /> Publish
            </Button>
          ) : null}
          {isPublished ? (
            <Button variant="outline" onClick={() => setAction('unpublish')}>
              <Undo2 aria-hidden /> Unpublish
            </Button>
          ) : null}
          {course.status === 'DRAFT' ? (
            <Button variant="ghost" onClick={() => setAction('archive')}>
              <Archive aria-hidden /> Archive
            </Button>
          ) : null}
          {course.status === 'ARCHIVED' ? (
            <Button variant="outline" onClick={() => setAction('restore')}>
              <RotateCcw aria-hidden /> Restore to draft
            </Button>
          ) : null}
          {course.status !== 'PUBLISHED' ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setAction('delete')}
              disabled={counts.modules > 0}
              title={
                counts.modules > 0
                  ? 'Courses with curriculum can be archived, not deleted'
                  : undefined
              }
            >
              <Trash2 aria-hidden /> Delete
            </Button>
          ) : null}
        </div>
        {course.status === 'DRAFT' && !publication.eligible ? (
          <p className="type-caption text-muted-foreground">
            Publish is disabled until the checklist is complete.
          </p>
        ) : null}
      </section>

      <aside
        className="grid content-start gap-4 rounded-xl border bg-card p-5 shadow-card"
        aria-labelledby="course-facts"
      >
        <h2 id="course-facts" className="type-h4 text-heading">
          At a glance
        </h2>
        <dl className="grid gap-3 type-body-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="grid gap-0.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        {isPublished && course.visibility !== 'PRIVATE' ? (
          <Button asChild variant="outline">
            <Link href={publicHref} target="_blank" rel="noopener">
              <ExternalLink aria-hidden /> View public page
            </Link>
          </Button>
        ) : (
          <p className="flex items-start gap-2 type-caption text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {isPublished
              ? VISIBILITY_OPTIONS.PRIVATE.description
              : 'Not visible on the public website until published.'}
          </p>
        )}
      </aside>

      {action ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setAction(null)}
          title={ACTIONS[action].title}
          description={describeAction(action, course)}
          confirmLabel={ACTIONS[action].confirm}
          pendingLabel={ACTIONS[action].pending}
          destructive={ACTIONS[action].destructive}
          onConfirm={() => run(action)}
        />
      ) : null}
    </div>
  );
}
