'use client';

import type { LiveClassDto, LiveClassSettingsDto, Paginated } from '@asra/types';
import {
  adminLiveClassCreateSchema,
  adminLiveClassUpdateSchema,
  liveClassCreateSchema,
  liveClassRecordingSchema,
  liveClassUpdateSchema,
  type LiveClassMeetingOption,
} from '@asra/validation';
import {
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MonitorPlay,
  Pencil,
  PlayCircle,
  RefreshCw,
  Video,
} from 'lucide-react';
import * as React from 'react';

import { ConfirmDialog, ErrorPanel, LoadingPanel, SelectField } from '@/components/admin/admin-ui';
import { errorMessage, useAdminApi, useApiResource } from '@/components/admin/use-admin';
import { ClassBadge, CourseFilter } from '@/components/faculty/faculty-ui';
import { EmptyState } from '@/components/public/empty-state';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import {
  canAddRecording,
  canCompleteClass,
  classTiming,
  isoToIstInput,
  istInputToIso,
  MEETING_PROVIDER_LABELS,
} from '@/lib/faculty/portal';
import { formatDateTime } from '@/lib/format';

/**
 * Live-class management shared by the admin portal (`/admin/live-classes`, any course, choose the
 * host) and the faculty portal (`/faculty/live-classes`, assigned courses only) — PHASE 11.
 * The API enforces every rule (scope, host assignment, state transitions); this UI only offers
 * the actions that make sense for each class. Times are entered and shown in IST (V-09).
 */

export type ManagerScope = 'admin' | 'faculty';

type Editing = { mode: 'create' } | { mode: 'edit'; item: LiveClassDto };
type Confirming = { kind: 'cancel' | 'complete'; item: LiveClassDto } | null;

const STATUS_FILTERS = [
  { value: 'all', label: 'Any status' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

/** Courses an admin can schedule for (first 100, by title). */
function AdminCourseSelect({
  id,
  value,
  onChange,
  allLabel,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  error?: string;
}) {
  const api = useAdminApi();
  const path = '/admin/courses?pageSize=100';
  const courses = useApiResource(path, () =>
    api.get<Paginated<{ id: string; title: string; status: string }>>(path),
  );
  const options = [
    ...(allLabel ? [{ value: 'all', label: allLabel }] : []),
    ...(courses.data?.items ?? [])
      .filter((course) => course.status !== 'ARCHIVED')
      .map((course) => ({ value: course.id, label: course.title })),
  ];
  return (
    <SelectField
      id={id}
      label="Course"
      value={value || (allLabel ? 'all' : '')}
      onValueChange={(next) => onChange(next === 'all' ? '' : next)}
      options={options}
      disabled={!courses.data}
      error={error}
      placeholder={courses.error ? errorMessage(courses.error) : 'Choose a course'}
    />
  );
}

/** Faculty assigned to the course — the only valid hosts. */
function HostSelect({
  courseId,
  value,
  onChange,
  error,
}: {
  courseId: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const api = useAdminApi();
  const path = courseId ? `/admin/courses/${courseId}/live-class-hosts` : null;
  const hosts = useApiResource(path, () =>
    api.get<{ facultyProfileId: string; fullName: string; isPrimary: boolean }[]>(path!),
  );
  const options = (hosts.data ?? []).map((host) => ({
    value: host.facultyProfileId,
    label: host.isPrimary ? `${host.fullName} (primary)` : host.fullName,
  }));
  const empty = hosts.data && hosts.data.length === 0;
  return (
    <SelectField
      id="class-host"
      label="Host faculty"
      value={value}
      onValueChange={onChange}
      options={options}
      disabled={!courseId || !hosts.data || empty}
      error={error}
      hint={
        empty
          ? 'Assign faculty to this course first (Courses › Faculty).'
          : 'Only faculty assigned to the course can host.'
      }
      placeholder={courseId ? 'Choose the host' : 'Choose a course first'}
    />
  );
}

export function LiveClassesManager({
  scope,
  courseId,
}: {
  scope: ManagerScope;
  courseId?: string;
}) {
  const api = useAdminApi();
  const base = `/${scope}/live-classes`;
  const [when, setWhen] = React.useState<'upcoming' | 'past'>('upcoming');
  const [page, setPage] = React.useState(1);
  const [filter, setFilter] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const [recording, setRecording] = React.useState<LiveClassDto | null>(null);
  const [confirming, setConfirming] = React.useState<Confirming>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const course = courseId ?? filter;
  const path = withQuery(base, {
    when,
    page,
    pageSize: 20,
    courseId: course,
    ...(scope === 'admin' ? { status } : {}),
  });
  const list = useApiResource(path, () => api.get<Paginated<LiveClassDto>>(path));
  const settings = useApiResource(`${base}/settings`, () =>
    api.get<LiveClassSettingsDto>(`${base}/settings`),
  );
  const googleAvailable = Boolean(settings.data?.googleMeet.available);

  async function requestMeeting(item: LiveClassDto) {
    setBusy(item.id);
    try {
      await api.post(`${base}/${item.id}/meeting`);
      toast.success('Google Meet link ready', { description: item.title });
    } catch (error) {
      toast.error('Could not create the Google Meet link', { description: errorMessage(error) });
    } finally {
      setBusy(null);
      list.reload();
    }
  }

  return (
    <div className="grid gap-4">
      {settings.data && !googleAvailable ? (
        <Alert tone="info" title="Automatic Google Meet links are off">
          <p>{settings.data.googleMeet.message}</p>
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
              {scope === 'admin' ? (
                <AdminCourseSelect
                  id="classes-course"
                  value={filter}
                  allLabel="All courses"
                  onChange={(value) => {
                    setFilter(value);
                    setPage(1);
                  }}
                />
              ) : (
                <CourseFilter
                  id="classes-course"
                  value={filter}
                  onChange={(value) => {
                    setFilter(value);
                    setPage(1);
                  }}
                />
              )}
            </div>
          )}
          {scope === 'admin' ? (
            <div className="w-48 max-w-full">
              <SelectField
                id="classes-status"
                label="Status"
                value={status || 'all'}
                onValueChange={(value) => {
                  setStatus(value === 'all' ? '' : value);
                  setPage(1);
                }}
                options={STATUS_FILTERS}
              />
            </div>
          ) : null}
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
              ? 'Schedule a class so enrolled students are notified and can join it.'
              : 'Classes appear here after they end. Add the recording link once it is on YouTube.'
          }
        />
      ) : (
        <div className="grid gap-4" aria-busy={list.loading || undefined}>
          <ul className="grid gap-3">
            {list.data.items.map((item) => (
              <ClassRow
                key={item.id}
                item={item}
                showCourse={!courseId}
                busy={busy === item.id}
                googleAvailable={googleAvailable}
                onEdit={() => setEditing({ mode: 'edit', item })}
                onCancel={() => setConfirming({ kind: 'cancel', item })}
                onComplete={() => setConfirming({ kind: 'complete', item })}
                onRecording={() => setRecording(item)}
                onRetryMeeting={() => void requestMeeting(item)}
              />
            ))}
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
          scope={scope}
          courseId={courseId}
          editing={editing}
          googleAvailable={googleAvailable}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      ) : null}
      {recording ? (
        <RecordingDialog
          base={base}
          item={recording}
          onClose={() => setRecording(null)}
          onSaved={() => {
            setRecording(null);
            list.reload();
          }}
        />
      ) : null}
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={
          confirming?.kind === 'complete'
            ? `Mark “${confirming.item.title}” as completed?`
            : `Cancel “${confirming?.item.title ?? ''}”?`
        }
        description={
          confirming?.kind === 'complete'
            ? 'Confirms the class was held. You can still add or change its recording link afterwards.'
            : 'Enrolled students are notified and the meeting link is hidden. This cannot be undone.'
        }
        confirmLabel={confirming?.kind === 'complete' ? 'Mark completed' : 'Cancel class'}
        pendingLabel={confirming?.kind === 'complete' ? 'Saving…' : 'Cancelling…'}
        destructive={confirming?.kind === 'cancel'}
        onConfirm={async () => {
          if (!confirming) return;
          const { kind, item } = confirming;
          try {
            await api.post(`${base}/${item.id}/${kind}`);
            toast.success(kind === 'complete' ? 'Class marked as completed' : 'Class cancelled', {
              description: item.title,
            });
            list.reload();
          } catch (error) {
            toast.error(
              kind === 'complete' ? 'Could not update the class' : 'Could not cancel the class',
              {
                description: errorMessage(error),
              },
            );
            throw error;
          }
        }}
      />
    </div>
  );
}

function ClassRow({
  item,
  showCourse,
  busy,
  googleAvailable,
  onEdit,
  onCancel,
  onComplete,
  onRecording,
  onRetryMeeting,
}: {
  item: LiveClassDto;
  showCourse: boolean;
  busy: boolean;
  googleAvailable: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onComplete: () => void;
  onRecording: () => void;
  onRetryMeeting: () => void;
}) {
  const timing = classTiming(item);
  const editable = timing === 'scheduled';
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4">
      <div className="grid min-w-0 flex-1 gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="type-label break-words text-heading">{item.title}</span>
          <ClassBadge item={item} />
          {item.provider ? (
            <Badge variant="outline">
              {MEETING_PROVIDER_LABELS[item.provider] ?? item.provider}
            </Badge>
          ) : null}
        </span>
        <span className="type-body-sm text-muted-foreground">
          {showCourse ? `${item.course.title} · ` : ''}
          {formatDateTime(item.startsAt, item.timeZone)} IST · {item.durationMinutes} min
          {item.host ? ` · ${item.host}` : ' · No host assigned'}
        </span>
        {item.description ? (
          <p className="type-body-sm whitespace-pre-line">{item.description}</p>
        ) : null}
        {item.joinUrl && editable ? (
          <a
            href={item.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 type-body-sm text-primary underline-offset-2 hover:underline"
          >
            <ExternalLink className="size-3.5" aria-hidden /> Open meeting link
          </a>
        ) : null}
        {editable && item.meetingState === 'PENDING' ? (
          <span className="inline-flex items-center gap-1 type-caption text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Creating the Google Meet link…
          </span>
        ) : null}
        {editable && item.meetingState === 'FAILED' ? (
          <Alert tone="warning" title="Google Meet link not created">
            <p>{item.meetingError}</p>
          </Alert>
        ) : null}
        {editable && item.meetingState === 'NONE' ? (
          <span className="type-caption text-muted-foreground">
            No meeting link yet — students see the time only.
          </span>
        ) : null}
        {item.recordingUrl ? (
          <a
            href={item.recordingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 type-body-sm text-primary underline-offset-2 hover:underline"
          >
            <PlayCircle className="size-3.5" aria-hidden /> Recording (YouTube)
          </a>
        ) : null}
      </div>
      <span className="flex flex-wrap gap-2">
        {editable ? (
          <>
            {item.meetingState === 'FAILED' || (item.meetingState === 'NONE' && googleAvailable) ? (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetryMeeting}
                loading={busy}
                loadingText="Creating…"
              >
                <RefreshCw aria-hidden />
                {item.meetingState === 'FAILED' ? 'Retry Google Meet' : 'Create Google Meet link'}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil aria-hidden /> Edit
            </Button>
          </>
        ) : null}
        {canCompleteClass(item) ? (
          <Button size="sm" variant="outline" onClick={onComplete}>
            <CheckCircle2 aria-hidden /> Mark completed
          </Button>
        ) : null}
        {canAddRecording(item) ? (
          <Button size="sm" variant="outline" onClick={onRecording}>
            <Video aria-hidden /> {item.recordingUrl ? 'Change recording' : 'Add recording'}
          </Button>
        ) : null}
        {editable ? (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel class
          </Button>
        ) : null}
      </span>
    </li>
  );
}

function ClassDialog({
  scope,
  courseId: fixedCourse,
  editing,
  googleAvailable,
  onClose,
  onSaved,
}: {
  scope: ManagerScope;
  courseId?: string;
  editing: Editing;
  googleAvailable: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useAdminApi();
  const existing = editing.mode === 'edit' ? editing.item : undefined;
  const [courseId, setCourseId] = React.useState(fixedCourse ?? existing?.course.id ?? '');
  const [hostId, setHostId] = React.useState(existing?.hostFacultyProfileId ?? '');
  const [title, setTitle] = React.useState(existing?.title ?? '');
  const [description, setDescription] = React.useState(existing?.description ?? '');
  const [start, setStart] = React.useState(isoToIstInput(existing?.startsAt));
  const [duration, setDuration] = React.useState(String(existing?.durationMinutes ?? 60));
  const [meeting, setMeeting] = React.useState<LiveClassMeetingOption>(
    googleAvailable && !existing ? 'google_meet' : 'manual',
  );
  const [joinUrl, setJoinUrl] = React.useState(
    existing?.provider === 'manual' ? (existing.joinUrl ?? '') : '',
  );
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const admin = scope === 'admin';
  const google = !existing && meeting === 'google_meet';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const startsAt = istInputToIso(start);
    const payload: Record<string, unknown> = {
      title,
      description,
      startsAt: startsAt ?? undefined,
      durationMinutes: duration.trim() === '' ? undefined : Number(duration),
    };
    if (existing) {
      // Only send a link change when the class uses a pasted link (or has none yet).
      if (existing.provider !== 'google_meet' || joinUrl) payload.joinUrl = joinUrl;
      if (admin && hostId && hostId !== existing.hostFacultyProfileId) {
        payload.hostFacultyProfileId = hostId;
      }
    } else {
      payload.meeting = meeting;
      if (!google) payload.joinUrl = joinUrl;
      if (admin) Object.assign(payload, { courseId, hostFacultyProfileId: hostId });
    }
    const schema = existing
      ? admin
        ? adminLiveClassUpdateSchema
        : liveClassUpdateSchema
      : admin
        ? adminLiveClassCreateSchema
        : liveClassCreateSchema;
    const parsed = validateForm(schema, payload);
    const local: FieldErrors = { ...(parsed.errors ?? {}) };
    if (startsAt === null) local.startsAt = 'Choose the date and start time';
    if (startsAt === undefined) local.startsAt = 'Enter a valid date and time';
    if (!existing && !courseId) local.courseId = 'Choose a course';
    if (admin && !existing && !hostId) local.hostFacultyProfileId = 'Choose the host faculty';
    setFormError(null);
    if (Object.keys(local).length > 0 || !parsed.data) return setErrors(local);
    setErrors({});
    setPending(true);
    try {
      if (existing) {
        await api.patch(`/${scope}/live-classes/${existing.id}`, parsed.data);
        toast.success('Class updated', { description: title });
      } else {
        const created = await api.post<LiveClassDto>(
          admin ? '/admin/live-classes' : `/faculty/courses/${courseId}/live-classes`,
          parsed.data,
        );
        if (created.meetingState === 'FAILED') {
          toast.warning('Class scheduled without a Google Meet link', {
            description: created.meetingError ?? 'Retry from the class list or paste a link.',
          });
        } else {
          toast.success('Class scheduled', {
            description: 'Enrolled students have been notified.',
          });
        }
      }
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
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit class' : 'Schedule a live class'}</DialogTitle>
          <DialogDescription>
            Times are in India Standard Time (IST). Enrolled students are notified when a class is
            scheduled, its time or link changes, or it is cancelled.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {formError ? (
            <Alert tone="error">
              <p>{formError}</p>
            </Alert>
          ) : null}
          {fixedCourse || existing ? null : admin ? (
            <AdminCourseSelect
              id="class-course"
              value={courseId}
              onChange={(value) => {
                setCourseId(value);
                setHostId('');
              }}
              error={errors.courseId}
            />
          ) : (
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
          {admin ? (
            <HostSelect
              courseId={courseId}
              value={hostId}
              onChange={setHostId}
              error={errors.hostFacultyProfileId}
            />
          ) : null}
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
          {existing ? null : (
            <fieldset className="grid gap-2">
              <legend className="type-label text-heading">Meeting link</legend>
              <label className="flex items-start gap-2 type-body-sm">
                <input
                  type="radio"
                  name="class-meeting"
                  className="mt-1 accent-asra-green-700"
                  checked={meeting === 'google_meet'}
                  disabled={!googleAvailable}
                  onChange={() => setMeeting('google_meet')}
                />
                <span>
                  Create a Google Meet link automatically
                  {googleAvailable ? null : (
                    <span className="block type-caption text-muted-foreground">
                      Not set up on this server.
                    </span>
                  )}
                </span>
              </label>
              <label className="flex items-start gap-2 type-body-sm">
                <input
                  type="radio"
                  name="class-meeting"
                  className="mt-1 accent-asra-green-700"
                  checked={meeting === 'manual'}
                  onChange={() => setMeeting('manual')}
                />
                <span>Paste a link from your own meeting tool (or add it later)</span>
              </label>
            </fieldset>
          )}
          {google ? null : (
            <Field
              id="class-link"
              label="Meeting link (https://)"
              optional
              error={errors.joinUrl}
              hint={
                existing?.provider === 'google_meet'
                  ? 'This class uses a Google Meet link. Paste a different link only to replace it.'
                  : 'Shown only to students enrolled in the course, until the class ends.'
              }
            >
              <Input
                type="url"
                inputMode="url"
                value={joinUrl}
                placeholder="https://…"
                onChange={(e) => setJoinUrl(e.target.value)}
              />
            </Field>
          )}
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

function RecordingDialog({
  base,
  item,
  onClose,
  onSaved,
}: {
  base: string;
  item: LiveClassDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useAdminApi();
  const [url, setUrl] = React.useState(item.recordingUrl ?? '');
  const [error, setError] = React.useState<string | undefined>();
  const [pending, setPending] = React.useState(false);

  async function save(recordingUrl: string) {
    const parsed = validateForm(liveClassRecordingSchema, { recordingUrl });
    if (!parsed.data) return setError(parsed.errors?.recordingUrl ?? 'Enter a YouTube video link');
    setError(undefined);
    setPending(true);
    try {
      await api.put(`${base}/${item.id}/recording`, parsed.data);
      toast.success(parsed.data.recordingUrl ? 'Recording link saved' : 'Recording link removed', {
        description: item.title,
      });
      onSaved();
    } catch (failure) {
      const described = describeError(failure);
      setError(described.fieldErrors.recordingUrl ?? described.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Recording link</DialogTitle>
          <DialogDescription>
            Upload the recording to the academy’s YouTube channel (unlisted), then paste its link.
            Only students enrolled in {item.course.title} see it in their portal — but an unlisted
            YouTube link can still be opened by anyone it is shared with.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save(url);
          }}
        >
          <Field
            id="recording-url"
            label="YouTube link"
            error={error}
            hint="e.g. https://youtu.be/…"
          >
            <Input
              type="url"
              inputMode="url"
              value={url}
              placeholder="https://www.youtube.com/watch?v=…"
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
          <DialogFooter>
            {item.recordingUrl ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => void save('')}
              >
                Remove link
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Close
            </Button>
            <Button type="submit" loading={pending} loadingText="Saving…">
              Save link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
