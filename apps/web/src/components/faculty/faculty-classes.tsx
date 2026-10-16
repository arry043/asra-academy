'use client';

import type { FacultyFeatures, LiveClassDto, Paginated } from '@asra/types';
import { liveClassCreateSchema, liveClassUpdateSchema } from '@asra/validation';
import { CalendarPlus, ExternalLink, MonitorPlay, Pencil } from 'lucide-react';
import * as React from 'react';

import { ConfirmDialog } from '@/components/admin/admin-ui';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/public/empty-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';
import { formatDateTime } from '@/lib/format';
import { classTiming, istInputToIso, isoToIstInput } from '@/lib/faculty/portal';

import {
  ClassBadge,
  CourseFilter,
  ErrorPanel,
  LoadingPanel,
  errorMessage,
  useApiResource,
  useFacultyApi,
  withQuery,
} from './faculty-ui';

const home = { label: 'Dashboard', href: '/faculty/dashboard' };

type Editing = { mode: 'create' } | { mode: 'edit'; item: LiveClassDto };

/**
 * Scheduling for the faculty member's courses. No provider is connected (F-01): the platform
 * creates no meetings and invents no links. A link pasted by faculty is shown to enrolled students
 * only. Times are entered and shown in IST (V-09).
 */
export function LiveClassesPanel({ courseId }: { courseId?: string }) {
  const api = useFacultyApi();
  const [when, setWhen] = React.useState<'upcoming' | 'past'>('upcoming');
  const [page, setPage] = React.useState(1);
  const [filter, setFilter] = React.useState('');
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const [cancelling, setCancelling] = React.useState<LiveClassDto | null>(null);
  const course = courseId ?? filter;
  const path = withQuery('/faculty/live-classes', { when, page, pageSize: 20, courseId: course });
  const list = useApiResource(path, () => api.get<Paginated<LiveClassDto>>(path));
  const features = useApiResource('/faculty/features', () =>
    api.get<FacultyFeatures>('/faculty/features'),
  );

  return (
    <div className="grid gap-4">
      {features.data && !features.data.liveClassProvider.available ? (
        <Alert tone="info" title="No live-class provider connected">
          <p>{features.data.liveClassProvider.message}</p>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Tabs
            value={when}
            onValueChange={(value) => {
              setWhen(value as 'upcoming' | 'past');
              setPage(1);
            }}
          >
            <TabsList aria-label="Which classes">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>
          </Tabs>
          {courseId ? null : (
            <div className="w-72 max-w-full">
              <CourseFilter
                id="classes-course"
                value={filter}
                onChange={(value) => {
                  setFilter(value);
                  setPage(1);
                }}
              />
            </div>
          )}
        </div>
        <Button onClick={() => setEditing({ mode: 'create' })}>
          <CalendarPlus aria-hidden /> Schedule a class
        </Button>
      </div>

      {list.error && !list.data ? (
        <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingPanel label="Loading classes…" />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={<MonitorPlay />}
          title={when === 'upcoming' ? 'No upcoming classes' : 'No past classes'}
          description={
            when === 'upcoming'
              ? 'Schedule a class so enrolled students can see when it takes place.'
              : 'Classes appear here after they end.'
          }
        />
      ) : (
        <div className="grid gap-4" aria-busy={list.loading || undefined}>
          <ul className="grid gap-3">
            {list.data.items.map((item) => {
              const timing = classTiming(item);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4"
                >
                  <div className="grid min-w-0 gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="type-label text-heading">{item.title}</span>
                      <ClassBadge item={item} />
                    </span>
                    <span className="type-body-sm text-muted-foreground">
                      {courseId ? '' : `${item.course.title} · `}
                      {formatDateTime(item.startsAt)} IST · {item.durationMinutes} min
                      {item.host ? ` · ${item.host}` : ''}
                    </span>
                    {item.description ? (
                      <p className="type-body-sm whitespace-pre-line">{item.description}</p>
                    ) : null}
                    {item.joinUrl ? (
                      <a
                        href={item.joinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 type-body-sm text-primary underline-offset-2 hover:underline"
                      >
                        <ExternalLink className="size-3.5" aria-hidden /> Meeting link (added by
                        faculty)
                      </a>
                    ) : timing === 'scheduled' ? (
                      <span className="type-caption text-muted-foreground">
                        No meeting link yet — students see the time only.
                      </span>
                    ) : null}
                  </div>
                  {timing === 'scheduled' ? (
                    <span className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing({ mode: 'edit', item })}
                      >
                        <Pencil aria-hidden /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setCancelling(item)}>
                        Cancel class
                      </Button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {list.data.pagination.pageCount > 1 ? (
            <Pagination
              page={list.data.pagination.page}
              pageCount={list.data.pagination.pageCount}
              onPageChange={setPage}
              label="Class pages"
            />
          ) : null}
        </div>
      )}

      {editing ? (
        <ClassDialog
          courseId={courseId}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      ) : null}
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={`Cancel “${cancelling?.title ?? ''}”?`}
        description="Students will see the class as cancelled and its meeting link is hidden. This cannot be undone."
        confirmLabel="Cancel class"
        pendingLabel="Cancelling…"
        destructive
        onConfirm={async () => {
          if (!cancelling) return;
          try {
            await api.post(`/faculty/live-classes/${cancelling.id}/cancel`);
            toast.success('Class cancelled', { description: cancelling.title });
            list.reload();
          } catch (error) {
            toast.error('Could not cancel the class', { description: errorMessage(error) });
            throw error;
          }
        }}
      />
    </div>
  );
}

function ClassDialog({
  courseId: fixedCourse,
  editing,
  onClose,
  onSaved,
}: {
  courseId?: string;
  editing: Editing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useFacultyApi();
  const existing = editing.mode === 'edit' ? editing.item : undefined;
  const [courseId, setCourseId] = React.useState(fixedCourse ?? existing?.course.id ?? '');
  const [title, setTitle] = React.useState(existing?.title ?? '');
  const [description, setDescription] = React.useState(existing?.description ?? '');
  const [start, setStart] = React.useState(isoToIstInput(existing?.startsAt));
  const [duration, setDuration] = React.useState(String(existing?.durationMinutes ?? 60));
  const [joinUrl, setJoinUrl] = React.useState(existing?.joinUrl ?? '');
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const startsAt = istInputToIso(start);
    const payload = {
      title,
      description,
      startsAt: startsAt ?? undefined,
      durationMinutes: duration.trim() === '' ? undefined : Number(duration),
      joinUrl,
    };
    const parsed = validateForm(existing ? liveClassUpdateSchema : liveClassCreateSchema, payload);
    const local: FieldErrors = { ...(parsed.errors ?? {}) };
    if (startsAt === null) local.startsAt = 'Choose the date and start time';
    if (startsAt === undefined) local.startsAt = 'Enter a valid date and time';
    if (!existing && !courseId) local.courseId = 'Choose a course';
    setFormError(null);
    if (Object.keys(local).length > 0 || !parsed.data) return setErrors(local);
    setErrors({});
    setPending(true);
    try {
      if (existing) await api.patch(`/faculty/live-classes/${existing.id}`, parsed.data);
      else await api.post(`/faculty/courses/${courseId}/live-classes`, parsed.data);
      toast.success(existing ? 'Class updated' : 'Class scheduled', { description: title });
      onSaved();
    } catch (error) {
      const described = describeError(error);
      setErrors(described.fieldErrors);
      setFormError(described.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit class' : 'Schedule a live class'}</DialogTitle>
          <DialogDescription>
            Times are in India Standard Time (IST). Create the meeting in your own meeting tool and
            paste its link, or leave it empty for now.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {formError ? (
            <Alert tone="error">
              <p>{formError}</p>
            </Alert>
          ) : null}
          {fixedCourse || existing ? null : (
            <div>
              <CourseFilter
                id="class-course"
                value={courseId}
                onChange={setCourseId}
                allLabel={null}
              />
              {errors.courseId ? (
                <p role="alert" className="mt-1 type-caption text-destructive">
                  {errors.courseId}
                </p>
              ) : null}
            </div>
          )}
          <Field id="class-title" label="Title" error={errors.title}>
            <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="class-start" label="Starts (IST)" error={errors.startsAt}>
              <Input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field
              id="class-duration"
              label="Duration (minutes)"
              error={errors.durationMinutes}
              hint="15–480 minutes"
            >
              <Input
                type="number"
                min={15}
                max={480}
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </Field>
          </div>
          <Field
            id="class-link"
            label="Meeting link (https://)"
            optional
            error={errors.joinUrl}
            hint="Shown only to students enrolled in the course, until the class ends."
          >
            <Input
              type="url"
              inputMode="url"
              value={joinUrl}
              placeholder="https://…"
              onChange={(e) => setJoinUrl(e.target.value)}
            />
          </Field>
          <Field id="class-description" label="Description" optional error={errors.description}>
            <Textarea
              value={description}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Close
            </Button>
            <Button type="submit" loading={pending} loadingText="Saving…">
              {existing ? 'Save changes' : 'Schedule class'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LiveClassesPage() {
  return (
    <>
      <PageHeader
        title="Live classes"
        breadcrumbs={[home, { label: 'Live classes' }]}
        description="Schedule online classes for your courses. Enrolled students see them in their portal."
      />
      <LiveClassesPanel />
    </>
  );
}
