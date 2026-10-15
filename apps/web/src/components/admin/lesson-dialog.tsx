'use client';

import type { LessonContentType, LessonDto, ResourceDto, ResourceKind } from '@asra/types';
import {
  LESSON_CONTENT_REQUIREMENTS,
  LESSON_CONTENT_TYPES,
  lessonContentIssue,
  lessonCreateSchema,
  lessonUpdateSchema,
  RESOURCE_TYPES,
  resourceInputSchema,
} from '@asra/validation';
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import * as React from 'react';

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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import {
  DEFAULT_RESOURCE_TYPE,
  LESSON_TYPE_LABELS,
  moveItem,
  RESOURCE_TYPE_LABELS,
} from '@/lib/admin/format';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';

import { SelectField } from './admin-ui';
import { errorMessage, useAdminApi } from './use-admin';

const BODY_LABELS: Partial<Record<LessonContentType, string>> = {
  TEXT: 'Lesson text',
  QUIZ: 'Quiz instructions',
  ASSIGNMENT: 'Assignment instructions',
};

/**
 * Create/edit a lesson and manage its resources. A new lesson is saved first; the dialog then
 * stays open so resources can be added to it. Resources are links (external HTTPS URLs) — file
 * uploads need the storage provider that is still pending (R-01/G-01), so no upload control is
 * shown.
 */
export function LessonDialog({
  chapterId,
  lesson: initialLesson,
  onClose,
  onChanged,
}: {
  chapterId: string;
  lesson?: LessonDto;
  onClose: () => void;
  onChanged: () => void;
}) {
  const api = useAdminApi();
  const [lesson, setLesson] = React.useState<LessonDto | undefined>(initialLesson);
  const [title, setTitle] = React.useState(initialLesson?.title ?? '');
  const [contentType, setContentType] = React.useState<LessonContentType>(
    initialLesson?.contentType ?? 'VIDEO',
  );
  const [status, setStatus] = React.useState<'DRAFT' | 'PUBLISHED'>(
    initialLesson?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
  );
  const [minutes, setMinutes] = React.useState(
    initialLesson?.durationSeconds ? String(Math.round(initialLesson.durationSeconds / 60)) : '',
  );
  const [description, setDescription] = React.useState(initialLesson?.description ?? '');
  const [body, setBody] = React.useState(initialLesson?.body ?? '');
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const requirement = LESSON_CONTENT_REQUIREMENTS[contentType];
  const issue = lesson
    ? lessonContentIssue({ contentType, body, resources: lesson.resources })
    : null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const durationSeconds = minutes.trim() === '' ? null : Math.round(Number(minutes) * 60);
    const payload = { title, contentType, status, description, body, durationSeconds };
    const parsed = validateForm(lesson ? lessonUpdateSchema : lessonCreateSchema, payload);
    setFormError(null);
    if (parsed.errors) {
      setErrors({
        ...parsed.errors,
        ...(parsed.errors.durationSeconds
          ? { minutes: 'Enter whole minutes (up to 24 hours)' }
          : {}),
      });
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const saved = lesson
        ? await api.patch<LessonDto>(`/admin/lessons/${lesson.id}`, parsed.data)
        : await api.post<LessonDto>(`/admin/chapters/${chapterId}/lessons`, parsed.data);
      setLesson(saved);
      toast.success(lesson ? 'Lesson saved' : 'Lesson created', {
        description: lesson ? saved.title : 'Now add its content below.',
      });
      onChanged();
    } catch (error) {
      const described = describeError(error);
      setErrors(described.fieldErrors);
      setFormError(described.message);
    } finally {
      setPending(false);
    }
  }

  async function reloadLesson(id: string) {
    try {
      setLesson(await api.get<LessonDto>(`/admin/lessons/${id}`));
    } catch (error) {
      toast.error('Could not refresh the lesson', { description: errorMessage(error) });
    }
    onChanged();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lesson ? `Edit lesson: ${lesson.title}` : 'Add lesson'}</DialogTitle>
          <DialogDescription>
            A lesson needs {requirement.description} before it can be published to students.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} noValidate className="grid gap-4">
          {formError ? (
            <Alert tone="error">
              <p>{formError}</p>
            </Alert>
          ) : null}
          <Field id="lesson-title" label="Title" error={errors.title}>
            <Input
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              id="lesson-type"
              label="Lesson type"
              error={errors.contentType}
              value={contentType}
              onValueChange={(value) => setContentType(value as LessonContentType)}
              options={LESSON_CONTENT_TYPES.map((type) => ({
                value: type,
                label: LESSON_TYPE_LABELS[type],
              }))}
            />
            <SelectField
              id="lesson-status"
              label="Status"
              error={errors.status}
              value={status}
              onValueChange={(value) => setStatus(value as 'DRAFT' | 'PUBLISHED')}
              options={[
                { value: 'DRAFT', label: 'Draft (hidden)' },
                { value: 'PUBLISHED', label: 'Published (ready)' },
              ]}
            />
            <Field id="lesson-minutes" label="Duration (minutes)" optional error={errors.minutes}>
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </Field>
          </div>
          {contentType === 'QUIZ' || contentType === 'ASSIGNMENT' ? (
            <Alert tone="info" title={`${LESSON_TYPE_LABELS[contentType]} placeholder`}>
              <p>
                Questions, submissions and grading arrive with the assessment system (PHASE 09). For
                now this lesson holds the instructions
                {contentType === 'ASSIGNMENT' ? ' and any worksheet or question-paper links' : ''}.
              </p>
            </Alert>
          ) : null}
          <Field
            id="lesson-description"
            label="Short description"
            optional
            error={errors.description}
          >
            <Textarea
              value={description}
              rows={2}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field
            id="lesson-body"
            label={BODY_LABELS[contentType] ?? 'Notes'}
            optional={!requirement.body}
            hint={
              requirement.body
                ? 'Required before the lesson can be published.'
                : 'Optional notes shown with the lesson.'
            }
            error={errors.body}
          >
            <Textarea value={body} rows={5} onChange={(event) => setBody(event.target.value)} />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="submit" loading={pending} loadingText="Saving…">
              {lesson ? 'Save lesson' : 'Create lesson'}
            </Button>
          </div>
        </form>

        <section className="grid gap-3 border-t pt-4" aria-labelledby="lesson-resources">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="lesson-resources" className="type-h4 text-heading">
              Content and resources
            </h3>
            {lesson ? (
              issue ? (
                <Badge variant="warning">
                  <CircleAlert aria-hidden /> {issue}
                </Badge>
              ) : (
                <Badge variant="success">
                  <CircleCheck aria-hidden /> Content complete
                </Badge>
              )
            ) : null}
          </div>
          {lesson ? (
            <ResourceManager
              lesson={lesson}
              contentType={contentType}
              onChanged={() => reloadLesson(lesson.id)}
            />
          ) : (
            <p className="type-body-sm text-muted-foreground">
              Create the lesson first, then add its video, PDF or links here.
            </p>
          )}
        </section>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResourceManager({
  lesson,
  contentType,
  onChanged,
}: {
  lesson: LessonDto;
  contentType: LessonContentType;
  onChanged: () => Promise<void>;
}) {
  const api = useAdminApi();
  const [editing, setEditing] = React.useState<ResourceDto | 'new' | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function act(key: string, work: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await work();
      toast.success(success);
      await onChanged();
    } catch (error) {
      toast.error('Could not update the resource', { description: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  const resources = lesson.resources;

  return (
    <div className="grid gap-3">
      {resources.length === 0 ? (
        <p className="type-body-sm text-muted-foreground">No resources yet.</p>
      ) : (
        <ol className="grid gap-2" aria-label="Resources">
          {resources.map((resource, index) => (
            <li
              key={resource.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <span className="grid min-w-0 gap-0.5">
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{RESOURCE_TYPE_LABELS[resource.type]}</Badge>
                  <span className="truncate font-medium text-heading">{resource.title}</span>
                </span>
                {resource.location.kind === 'external' ? (
                  <a
                    href={resource.location.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 truncate type-caption text-primary underline-offset-2 hover:underline"
                  >
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{resource.location.externalUrl}</span>
                  </a>
                ) : (
                  <span className="type-caption text-muted-foreground">
                    Stored file ({resource.location.storageProvider})
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${resource.title} up`}
                  disabled={index === 0 || busy !== null}
                  onClick={() =>
                    act(
                      resource.id,
                      () =>
                        api.put(`/admin/lessons/${lesson.id}/resources/order`, {
                          orderedIds: moveItem(resources, index, -1)!.map((item) => item.id),
                        }),
                      'Order saved',
                    )
                  }
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${resource.title} down`}
                  disabled={index === resources.length - 1 || busy !== null}
                  onClick={() =>
                    act(
                      resource.id,
                      () =>
                        api.put(`/admin/lessons/${lesson.id}/resources/order`, {
                          orderedIds: moveItem(resources, index, 1)!.map((item) => item.id),
                        }),
                      'Order saved',
                    )
                  }
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${resource.title}`}
                  onClick={() => setEditing(resource)}
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${resource.title}`}
                  loading={busy === `delete-${resource.id}`}
                  disabled={busy !== null}
                  onClick={() =>
                    act(
                      `delete-${resource.id}`,
                      () => api.del(`/admin/resources/${resource.id}`),
                      'Resource removed',
                    )
                  }
                >
                  {busy === `delete-${resource.id}` ? null : <Trash2 aria-hidden />}
                </Button>
              </span>
            </li>
          ))}
        </ol>
      )}

      {editing ? (
        <ResourceForm
          lessonId={lesson.id}
          resource={editing === 'new' ? undefined : editing}
          defaultType={DEFAULT_RESOURCE_TYPE[contentType]}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
          }}
        />
      ) : (
        <div>
          <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
            <Plus aria-hidden /> Add resource link
          </Button>
        </div>
      )}
    </div>
  );
}

function ResourceForm({
  lessonId,
  resource,
  defaultType,
  onCancel,
  onSaved,
}: {
  lessonId: string;
  resource?: ResourceDto;
  defaultType: ResourceKind;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const api = useAdminApi();
  const [title, setTitle] = React.useState(resource?.title ?? '');
  const [type, setType] = React.useState<ResourceKind>(resource?.type ?? defaultType);
  const [url, setUrl] = React.useState(
    resource?.location.kind === 'external' ? resource.location.externalUrl : '',
  );
  const [mimeType, setMimeType] = React.useState(resource?.mimeType ?? '');
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Submitted through a button handler (not a nested <form>, which HTML does not allow).
  async function submit() {
    if (pending) return;
    const payload = {
      title,
      type,
      location: { kind: 'external' as const, externalUrl: url },
      mimeType: mimeType.trim() === '' ? null : mimeType,
    };
    const parsed = validateForm(resourceInputSchema, payload);
    setFormError(null);
    if (parsed.errors) {
      const issues = resourceInputSchema.safeParse(payload).error?.issues ?? [];
      const urlIssue = issues.find((issue) => issue.path[0] === 'location');
      setErrors({ ...parsed.errors, ...(urlIssue ? { url: urlIssue.message } : {}) });
      return;
    }
    setErrors({});
    setPending(true);
    try {
      if (resource) await api.patch(`/admin/resources/${resource.id}`, parsed.data);
      else await api.post(`/admin/lessons/${lessonId}/resources`, parsed.data);
      toast.success(resource ? 'Resource saved' : 'Resource added', { description: title });
      await onSaved();
    } catch (error) {
      const described = describeError(error);
      setErrors({
        ...described.fieldErrors,
        ...(described.fieldErrors.location ? { url: described.fieldErrors.location } : {}),
      });
      setFormError(described.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="grid gap-3 rounded-lg border bg-asra-warm-white p-4"
      role="group"
      aria-label={resource ? 'Edit resource' : 'New resource'}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
          event.preventDefault();
          void submit();
        }
      }}
    >
      {formError ? (
        <Alert tone="error">
          <p>{formError}</p>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <Field id="resource-title" label="Title" error={errors.title}>
          <Input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <SelectField
          id="resource-type"
          label="Type"
          error={errors.type}
          value={type}
          onValueChange={(value) => setType(value as ResourceKind)}
          options={RESOURCE_TYPES.map((value) => ({ value, label: RESOURCE_TYPE_LABELS[value] }))}
        />
      </div>
      <Field
        id="resource-url"
        label="Link (https://)"
        error={errors.url}
        hint="A video page (e.g. YouTube or Vimeo), a PDF or document link, or any external page. Uploading files needs a storage provider (pending)."
      >
        <Input
          type="url"
          inputMode="url"
          value={url}
          placeholder="https://…"
          onChange={(event) => setUrl(event.target.value)}
        />
      </Field>
      <Field
        id="resource-mime"
        label="MIME type"
        optional
        error={errors.mimeType}
        hint="e.g. application/pdf"
      >
        <Input value={mimeType} onChange={(event) => setMimeType(event.target.value)} />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void submit()} loading={pending} loadingText="Saving…">
          {resource ? 'Save resource' : 'Add resource'}
        </Button>
      </div>
    </div>
  );
}
