'use client';

import type { ChapterDto, CurriculumTreeDto, LessonDto, ModuleDto } from '@asra/types';
import { lessonContentIssue, chapterCreateSchema, moduleCreateSchema } from '@asra/validation';
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  FilePlus2,
  FolderPlus,
  ListPlus,
  Pencil,
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
import { LESSON_TYPE_LABELS, moveItem } from '@/lib/admin/format';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';
import { formatDuration } from '@/lib/format';

import { ConfirmDialog, ErrorPanel, LoadingPanel, StatusBadge } from './admin-ui';
import { useCurriculumBase } from './curriculum-api';
import { LessonDialog } from './lesson-dialog';
import { errorMessage, useAdminApi, useApiResource, type AdminApi } from './use-admin';

type SectionTarget =
  | { kind: 'module'; mode: 'create'; courseId: string }
  | { kind: 'module'; mode: 'edit'; item: ModuleDto }
  | { kind: 'chapter'; mode: 'create'; moduleId: string }
  | { kind: 'chapter'; mode: 'edit'; item: ChapterDto };

type LessonTarget = { chapterId: string; lesson?: LessonDto };

type DeleteTarget =
  | { kind: 'module'; item: ModuleDto }
  | { kind: 'chapter'; item: ChapterDto }
  | { kind: 'lesson'; item: LessonDto };

/**
 * Curriculum editor: Course → Module → Chapter → Lesson (→ resources in the lesson dialog).
 * Reordering uses explicit Move up / Move down buttons (keyboard and screen-reader friendly, no
 * drag-and-drop dependency). After every change the tree is reloaded from the server, so what is
 * shown is always what was saved.
 */
export function CurriculumEditor({
  courseId,
  onChanged,
}: {
  courseId: string;
  onChanged: () => void;
}) {
  const api = useAdminApi();
  const base = useCurriculumBase();
  const path = `${base}/courses/${courseId}/curriculum`;
  const tree = useApiResource(path, () => api.get<CurriculumTreeDto>(path));
  const [section, setSection] = React.useState<SectionTarget | null>(null);
  const [lesson, setLesson] = React.useState<LessonTarget | null>(null);
  const [deleting, setDeleting] = React.useState<DeleteTarget | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    tree.reload();
    onChanged();
  }, [tree, onChanged]);

  async function reorder(key: string, url: string, ids: string[] | null) {
    if (!ids) return;
    setBusy(key);
    try {
      await api.put(url, { orderedIds: ids });
      refresh();
    } catch (error) {
      toast.error('Could not save the new order', { description: errorMessage(error) });
      tree.reload();
    } finally {
      setBusy(null);
    }
  }

  async function remove(target: DeleteTarget) {
    const url = `${base}/${target.kind === 'module' ? 'modules' : target.kind === 'chapter' ? 'chapters' : 'lessons'}/${target.item.id}`;
    try {
      await api.del(url);
      toast.success(`${target.kind[0]!.toUpperCase()}${target.kind.slice(1)} deleted`, {
        description: target.item.title,
      });
      refresh();
    } catch (error) {
      toast.error(`Could not delete “${target.item.title}”`, { description: errorMessage(error) });
      throw error;
    }
  }

  if (tree.error && !tree.data) {
    return (
      <ErrorPanel
        title="Could not load the curriculum"
        message={errorMessage(tree.error)}
        onRetry={tree.reload}
      />
    );
  }
  if (!tree.data) return <LoadingPanel label="Loading curriculum…" rows={5} />;

  const modules = tree.data.modules;
  const live = tree.data.courseStatus === 'PUBLISHED';

  return (
    <div className="grid gap-4" aria-busy={tree.loading || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl type-body-sm text-muted-foreground">
          Organise the course into modules, chapters and lessons. Only lessons marked{' '}
          <strong>Published</strong> are shown to students and the public outline; draft lessons
          stay private.
        </p>
        <Button onClick={() => setSection({ kind: 'module', mode: 'create', courseId })}>
          <FolderPlus aria-hidden /> Add module
        </Button>
      </div>
      {live ? (
        <Alert tone="info" title="This course is live">
          <p>
            Changes save immediately. Removing the last published content is refused — unpublish the
            course first.
          </p>
        </Alert>
      ) : null}
      {tree.error ? (
        <ErrorPanel
          title="Could not refresh"
          message={errorMessage(tree.error)}
          onRetry={tree.reload}
        />
      ) : null}

      {modules.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <p className="type-h4 text-heading">No modules yet</p>
          <p className="max-w-md type-body-sm text-muted-foreground">
            Start with a module (e.g. “Algebra”), then add chapters and lessons inside it.
          </p>
          <Button onClick={() => setSection({ kind: 'module', mode: 'create', courseId })}>
            <FolderPlus aria-hidden /> Add the first module
          </Button>
        </div>
      ) : (
        <ol className="grid gap-4" aria-label="Modules">
          {modules.map((module, moduleIndex) => (
            <li key={module.id} className="rounded-xl border bg-card shadow-card">
              <ItemHeader
                level="module"
                title={`${moduleIndex + 1}. ${module.title}`}
                description={module.description}
                busy={busy === `module-${module.id}`}
                onUp={() =>
                  reorder(
                    `module-${module.id}`,
                    `${base}/courses/${courseId}/modules/order`,
                    moveIds(modules, moduleIndex, -1),
                  )
                }
                onDown={() =>
                  reorder(
                    `module-${module.id}`,
                    `${base}/courses/${courseId}/modules/order`,
                    moveIds(modules, moduleIndex, 1),
                  )
                }
                first={moduleIndex === 0}
                last={moduleIndex === modules.length - 1}
                onEdit={() => setSection({ kind: 'module', mode: 'edit', item: module })}
                onDelete={() => setDeleting({ kind: 'module', item: module })}
                addLabel="Add chapter"
                addIcon={<ListPlus aria-hidden />}
                onAdd={() => setSection({ kind: 'chapter', mode: 'create', moduleId: module.id })}
              />
              <div className="border-t px-4 py-3 sm:px-5">
                {module.chapters.length === 0 ? (
                  <p className="type-body-sm text-muted-foreground">
                    No chapters in this module yet.
                  </p>
                ) : (
                  <ol className="grid gap-3" aria-label={`Chapters of ${module.title}`}>
                    {module.chapters.map((chapter, chapterIndex) => (
                      <li key={chapter.id} className="rounded-lg border bg-asra-warm-white">
                        <ItemHeader
                          level="chapter"
                          title={`${moduleIndex + 1}.${chapterIndex + 1} ${chapter.title}`}
                          description={chapter.description}
                          busy={busy === `chapter-${chapter.id}`}
                          onUp={() =>
                            reorder(
                              `chapter-${chapter.id}`,
                              `${base}/modules/${module.id}/chapters/order`,
                              moveIds(module.chapters, chapterIndex, -1),
                            )
                          }
                          onDown={() =>
                            reorder(
                              `chapter-${chapter.id}`,
                              `${base}/modules/${module.id}/chapters/order`,
                              moveIds(module.chapters, chapterIndex, 1),
                            )
                          }
                          first={chapterIndex === 0}
                          last={chapterIndex === module.chapters.length - 1}
                          onEdit={() =>
                            setSection({ kind: 'chapter', mode: 'edit', item: chapter })
                          }
                          onDelete={() => setDeleting({ kind: 'chapter', item: chapter })}
                          addLabel="Add lesson"
                          addIcon={<FilePlus2 aria-hidden />}
                          onAdd={() => setLesson({ chapterId: chapter.id })}
                        />
                        <LessonList
                          chapter={chapter}
                          busyKey={busy}
                          onOpen={(item) => setLesson({ chapterId: chapter.id, lesson: item })}
                          onDelete={(item) => setDeleting({ kind: 'lesson', item })}
                          onMove={(index, delta) =>
                            reorder(
                              `lesson-${chapter.lessons[index]?.id}`,
                              `${base}/chapters/${chapter.id}/lessons/order`,
                              moveIds(chapter.lessons, index, delta),
                            )
                          }
                        />
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {section ? (
        <SectionDialog
          api={api}
          target={section}
          onClose={() => setSection(null)}
          onSaved={() => {
            setSection(null);
            refresh();
          }}
        />
      ) : null}
      {lesson ? (
        <LessonDialog
          chapterId={lesson.chapterId}
          lesson={lesson.lesson}
          onClose={() => setLesson(null)}
          onChanged={refresh}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.item.title ?? ''}”?`}
        description={
          deleting?.kind === 'lesson'
            ? `This deletes the lesson and its ${deleting.item.resources.length} resource link(s). It cannot be undone.`
            : `Only an empty ${deleting?.kind ?? 'item'} can be deleted — remove what is inside it first.`
        }
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        destructive
        onConfirm={() => (deleting ? remove(deleting) : Promise.resolve())}
      />
    </div>
  );
}

function moveIds(items: readonly { id: string }[], index: number, delta: -1 | 1): string[] | null {
  return moveItem(items, index, delta)?.map((item) => item.id) ?? null;
}

function ItemHeader({
  level,
  title,
  description,
  busy,
  first,
  last,
  onUp,
  onDown,
  onEdit,
  onDelete,
  addLabel,
  addIcon,
  onAdd,
}: {
  level: 'module' | 'chapter';
  title: string;
  description: string | null;
  busy: boolean;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  addLabel: string;
  addIcon: React.ReactNode;
  onAdd: () => void;
}) {
  const Heading = level === 'module' ? 'h3' : 'h4';
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="grid min-w-0 gap-0.5">
        <Heading
          className={level === 'module' ? 'type-h4 text-heading' : 'type-label text-heading'}
        >
          {title}
        </Heading>
        {description ? (
          <p className="line-clamp-2 type-body-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Move ${title} up`}
          disabled={first || busy}
          onClick={onUp}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Move ${title} down`}
          disabled={last || busy}
          onClick={onDown}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${title}`} onClick={onEdit}>
          <Pencil aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${title}`} onClick={onDelete}>
          <Trash2 aria-hidden />
        </Button>
        <Button variant="outline" size="sm" onClick={onAdd}>
          {addIcon} {addLabel}
        </Button>
      </div>
    </div>
  );
}

function LessonList({
  chapter,
  busyKey,
  onOpen,
  onDelete,
  onMove,
}: {
  chapter: ChapterDto;
  busyKey: string | null;
  onOpen: (lesson: LessonDto) => void;
  onDelete: (lesson: LessonDto) => void;
  onMove: (index: number, delta: -1 | 1) => void;
}) {
  if (chapter.lessons.length === 0) {
    return (
      <p className="border-t px-4 py-3 type-body-sm text-muted-foreground sm:px-5">
        No lessons in this chapter yet.
      </p>
    );
  }
  return (
    <ol className="grid border-t" aria-label={`Lessons of ${chapter.title}`}>
      {chapter.lessons.map((lesson, index) => {
        const issue = lessonContentIssue(lesson);
        const busy = busyKey === `lesson-${lesson.id}`;
        return (
          <li
            key={lesson.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 last:border-b-0 sm:px-5"
          >
            <button
              type="button"
              onClick={() => onOpen(lesson)}
              className="grid min-w-0 cursor-pointer gap-1 rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="truncate font-medium text-heading hover:text-primary hover:underline">
                {lesson.title}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{LESSON_TYPE_LABELS[lesson.contentType]}</Badge>
                <StatusBadge status={lesson.status} />
                <span className="type-caption text-muted-foreground">
                  {lesson.resources.length} resource{lesson.resources.length === 1 ? '' : 's'}
                  {lesson.durationSeconds
                    ? ` · ${formatDuration(lesson.durationSeconds / 60)}`
                    : ''}
                </span>
                {issue ? (
                  <Badge variant="warning">
                    <CircleAlert aria-hidden />
                    {issue}
                  </Badge>
                ) : null}
              </span>
            </button>
            <span className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${lesson.title} up`}
                disabled={index === 0 || busy}
                onClick={() => onMove(index, -1)}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${lesson.title} down`}
                disabled={index === chapter.lessons.length - 1 || busy}
                onClick={() => onMove(index, 1)}
              >
                <ArrowDown aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${lesson.title}`}
                onClick={() => onOpen(lesson)}
              >
                <Pencil aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${lesson.title}`}
                onClick={() => onDelete(lesson)}
              >
                <Trash2 aria-hidden />
              </Button>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SectionDialog({
  api,
  target,
  onClose,
  onSaved,
}: {
  api: AdminApi;
  target: SectionTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const base = useCurriculumBase();
  const existing = target.mode === 'edit' ? target.item : undefined;
  const [title, setTitle] = React.useState(existing?.title ?? '');
  const [description, setDescription] = React.useState(existing?.description ?? '');
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const noun = target.kind === 'module' ? 'module' : 'chapter';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = validateForm(
      target.kind === 'module' ? moduleCreateSchema : chapterCreateSchema,
      { title, description },
    );
    setFormError(null);
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    setPending(true);
    try {
      if (target.mode === 'create') {
        const url =
          target.kind === 'module'
            ? `${base}/courses/${target.courseId}/modules`
            : `${base}/modules/${target.moduleId}/chapters`;
        await api.post(url, parsed.data);
      } else {
        await api.patch(
          `${base}/${target.kind === 'module' ? 'modules' : 'chapters'}/${target.item.id}`,
          parsed.data,
        );
      }
      toast.success(`${noun[0]!.toUpperCase()}${noun.slice(1)} saved`, {
        description: parsed.data.title,
      });
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${noun}` : `Add ${noun}`}</DialogTitle>
          <DialogDescription>
            {target.kind === 'module'
              ? 'A module groups related chapters, e.g. “Algebra”.'
              : 'A chapter groups lessons, e.g. “Quadratic Equations”.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {formError ? (
            <Alert tone="error">
              <p>{formError}</p>
            </Alert>
          ) : null}
          <Field id="section-title" label="Title" error={errors.title}>
            <Input
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field id="section-description" label="Description" optional error={errors.description}>
            <Textarea
              value={description}
              rows={3}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} loadingText="Saving…">
              {existing ? 'Save changes' : `Add ${noun}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
