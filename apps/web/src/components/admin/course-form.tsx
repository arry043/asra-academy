'use client';

import type { AdminCourseDetail, CourseVisibility, DiscountType } from '@asra/types';
import { courseCreateSchema, courseUpdateSchema, SUPPORTED_CURRENCIES } from '@asra/validation';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import {
  joinMinutes,
  minorToInput,
  parseMoneyInput,
  splitMinutes,
  VISIBILITY_OPTIONS,
} from '@/lib/admin/format';
import { ApiClientError } from '@/lib/api';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';

import { ErrorPanel, LoadingPanel, SelectField } from './admin-ui';
import { useCourseOptions, type CourseOptions } from './course-options';
import { errorMessage, useAdminApi } from './use-admin';

const NONE = 'none';

interface FormState {
  title: string;
  slug: string;
  summary: string;
  description: string;
  visibility: CourseVisibility;
  categoryId: string;
  classId: string;
  streamId: string;
  subjectId: string;
  thumbnailUrl: string;
  durationHours: string;
  durationMinutes: string;
  price: string;
  currency: string;
  discountType: DiscountType | typeof NONE;
  discountValue: string;
}

function initialState(course?: AdminCourseDetail): FormState {
  const duration = splitMinutes(course?.durationMinutes ?? null);
  return {
    title: course?.title ?? '',
    slug: course?.slug ?? '',
    summary: course?.summary ?? '',
    description: course?.description ?? '',
    visibility: course?.visibility ?? 'PUBLIC',
    categoryId: course?.category?.id ?? NONE,
    classId: course?.class?.id ?? NONE,
    streamId: course?.stream?.id ?? NONE,
    subjectId: course?.subject?.id ?? NONE,
    thumbnailUrl: course?.thumbnailUrl ?? '',
    durationHours: duration.hours,
    durationMinutes: duration.minutes,
    price: minorToInput(course?.priceMinor),
    currency: course?.currency ?? SUPPORTED_CURRENCIES[0],
    discountType: course?.discountType ?? NONE,
    discountValue:
      course?.discountType === 'FIXED_AMOUNT'
        ? minorToInput(course.discountValue)
        : course?.discountValue === null || course?.discountValue === undefined
          ? ''
          : String(course.discountValue),
  };
}

/** Form state → request body. Returns local errors for inputs the schema cannot interpret. */
export function toCoursePayload(state: FormState): {
  body: Record<string, unknown>;
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};
  const priceMinor = parseMoneyInput(state.price);
  if (priceMinor === undefined) errors.priceMinor = 'Enter an amount such as 2500 or 2500.50';
  const durationMinutes = joinMinutes(state.durationHours, state.durationMinutes);
  if (durationMinutes === undefined) errors.durationMinutes = 'Use whole hours and minutes';

  let discountValue: number | null | undefined = null;
  if (state.discountType === 'PERCENTAGE') {
    discountValue = state.discountValue.trim() === '' ? null : Number(state.discountValue);
  } else if (state.discountType === 'FIXED_AMOUNT') {
    discountValue = parseMoneyInput(state.discountValue);
    if (discountValue === undefined) errors.discountValue = 'Enter an amount such as 500 or 499.50';
  }

  const relation = (value: string) => (value === NONE ? null : value);
  return {
    errors,
    body: {
      title: state.title,
      slug: state.slug,
      summary: state.summary,
      description: state.description,
      visibility: state.visibility,
      categoryId: relation(state.categoryId),
      classId: relation(state.classId),
      streamId: relation(state.streamId),
      subjectId: relation(state.subjectId),
      thumbnailUrl: state.thumbnailUrl,
      durationMinutes: durationMinutes ?? null,
      priceMinor: priceMinor ?? null,
      currency: priceMinor === null || priceMinor === undefined ? null : state.currency,
      discountType: state.discountType === NONE ? null : state.discountType,
      discountValue: discountValue ?? null,
    },
  };
}

export function CourseForm({
  course,
  onSaved,
}: {
  /** Omit to create a course. */
  course?: AdminCourseDetail;
  onSaved?: (course: AdminCourseDetail) => void;
}) {
  const options = useCourseOptions();
  if (options.error) {
    return (
      <ErrorPanel
        title="Could not load categories, classes and subjects"
        message={errorMessage(options.error)}
        onRetry={options.reload}
      />
    );
  }
  if (!options.data) return <LoadingPanel label="Loading form…" rows={6} />;
  // Remount when a different version of the course is loaded, so the form shows fresh values.
  return (
    <CourseFormFields
      key={course?.updatedAt ?? 'new'}
      course={course}
      options={options.data}
      onSaved={onSaved}
    />
  );
}

function CourseFormFields({
  course,
  options,
  onSaved,
}: {
  course?: AdminCourseDetail;
  options: CourseOptions;
  onSaved?: (course: AdminCourseDetail) => void;
}) {
  const api = useAdminApi();
  const router = useRouter();
  const [state, setState] = React.useState<FormState>(() => initialState(course));
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [stale, setStale] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const isNew = !course;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  const selectedClass = options.classes.find((item) => item.id === state.classId);
  const streams = options.streams.filter(
    (stream) => selectedClass && stream.academicLevelId === selectedClass.academicLevelId,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    setStale(false);
    const { body, errors: localErrors } = toCoursePayload(state);
    const parsed = validateForm(isNew ? courseCreateSchema : courseUpdateSchema, {
      ...body,
      ...(course ? { expectedUpdatedAt: course.updatedAt } : {}),
    });
    const allErrors = { ...(parsed.errors ?? {}), ...localErrors };
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      setFormError('Please correct the highlighted fields.');
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const saved = isNew
        ? await api.post<AdminCourseDetail>('/admin/courses', parsed.data)
        : await api.patch<AdminCourseDetail>(`/admin/courses/${course.id}`, parsed.data);
      toast.success(isNew ? 'Course created' : 'Course saved', { description: saved.title });
      if (isNew) router.push(`/admin/courses/${saved.id}`);
      else onSaved?.(saved);
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        error.code === 'CONFLICT' &&
        !Object.keys(error.fieldErrors).length
      ) {
        setStale(true);
      }
      const { message, fieldErrors } = describeError(error);
      setErrors(fieldErrors);
      setFormError(message);
    } finally {
      setPending(false);
    }
  }

  const relationSelect = (
    key: 'categoryId' | 'classId' | 'subjectId',
    label: string,
    items: { id: string; name: string; isActive: boolean }[],
    hint?: string,
  ) => (
    <SelectField
      id={`course-${key}`}
      label={label}
      optional
      hint={hint}
      error={errors[key]}
      value={state[key]}
      onValueChange={(value) => {
        set(key, value);
        if (key === 'classId') set('streamId', NONE);
      }}
      options={[
        { value: NONE, label: 'None' },
        ...items.map((item) => ({
          value: item.id,
          label: item.isActive ? item.name : `${item.name} (inactive)`,
          disabled: !item.isActive && item.id !== state[key],
        })),
      ]}
    />
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      {course?.status === 'PUBLISHED' ? (
        <Alert tone="info" title="This course is live">
          <p>
            Saved changes appear on the public website immediately. Changes that would break a
            publication requirement are refused — unpublish first to make them.
          </p>
        </Alert>
      ) : null}
      {formError ? (
        <Alert tone="error" title={stale ? 'Someone else changed this course' : undefined}>
          <p>{formError}</p>
          {stale ? (
            <p>
              Your edits are still in the form. Copy anything you need, then reload the page to see
              the latest version.
            </p>
          ) : null}
        </Alert>
      ) : null}

      <section
        className="grid gap-4 rounded-xl border bg-card p-5 shadow-card"
        aria-labelledby="course-basics"
      >
        <h2 id="course-basics" className="type-h4 text-heading">
          Basics
        </h2>
        <Field id="course-title" label="Title" error={errors.title}>
          <Input
            value={state.title}
            maxLength={200}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
        <Field
          id="course-slug"
          label="Slug (web address)"
          optional
          error={errors.slug}
          hint={
            isNew
              ? 'Generated from the title when left empty, e.g. class-10-mathematics.'
              : 'Changing the slug of a published course breaks links that were already shared.'
          }
        >
          <Input
            value={state.slug}
            maxLength={220}
            onChange={(e) => set('slug', e.target.value.toLowerCase())}
          />
        </Field>
        <Field
          id="course-summary"
          label="Summary"
          optional
          hint="One or two sentences for course cards."
          error={errors.summary}
        >
          <Textarea
            value={state.summary}
            rows={2}
            maxLength={500}
            onChange={(e) => set('summary', e.target.value)}
          />
        </Field>
        <Field
          id="course-description"
          label="Description"
          optional
          hint="Required before publishing."
          error={errors.description}
        >
          <Textarea
            value={state.description}
            rows={6}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
        <Field
          id="course-thumbnail"
          label="Thumbnail image URL"
          optional
          error={errors.thumbnailUrl}
          hint="An https:// link to an image. File uploads arrive once a storage provider is chosen (R-01)."
        >
          <Input
            type="url"
            inputMode="url"
            value={state.thumbnailUrl}
            placeholder="https://…"
            onChange={(e) => set('thumbnailUrl', e.target.value)}
          />
        </Field>
      </section>

      <section
        className="grid gap-4 rounded-xl border bg-card p-5 shadow-card"
        aria-labelledby="course-placement"
      >
        <div className="grid gap-1">
          <h2 id="course-placement" className="type-h4 text-heading">
            Placement
          </h2>
          <p className="type-body-sm text-muted-foreground">
            Publishing needs a category, or both a class and a subject.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {relationSelect('categoryId', 'Category', options.categories)}
          {relationSelect('subjectId', 'Subject', options.subjects)}
          {relationSelect('classId', 'Class', options.classes, 'Leave empty for special courses.')}
          <SelectField
            id="course-streamId"
            label="Stream"
            optional
            error={errors.streamId}
            hint={
              selectedClass
                ? 'Streams of the selected class’s academic level.'
                : 'Choose a class first.'
            }
            disabled={!selectedClass}
            value={state.streamId}
            onValueChange={(value) => set('streamId', value)}
            options={[
              { value: NONE, label: 'None' },
              ...streams.map((stream) => ({
                value: stream.id,
                label: stream.isActive ? stream.name : `${stream.name} (inactive)`,
                disabled: !stream.isActive && stream.id !== state.streamId,
              })),
            ]}
          />
        </div>
      </section>

      <section
        className="grid gap-4 rounded-xl border bg-card p-5 shadow-card"
        aria-labelledby="course-access"
      >
        <h2 id="course-access" className="type-h4 text-heading">
          Visibility, duration and price
        </h2>
        <SelectField
          id="course-visibility"
          label="Visibility"
          hint={VISIBILITY_OPTIONS[state.visibility].description}
          error={errors.visibility}
          value={state.visibility}
          onValueChange={(value) => set('visibility', value as CourseVisibility)}
          options={(Object.keys(VISIBILITY_OPTIONS) as CourseVisibility[]).map((value) => ({
            value,
            label: VISIBILITY_OPTIONS[value].label,
          }))}
        />

        <fieldset className="grid gap-2">
          <legend className="type-label">
            Estimated learning time{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            <Field id="course-duration-hours" label="Hours" error={errors.durationMinutes}>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={state.durationHours}
                onChange={(e) => set('durationHours', e.target.value)}
              />
            </Field>
            <Field id="course-duration-minutes" label="Minutes">
              <Input
                type="number"
                min={0}
                max={59}
                inputMode="numeric"
                value={state.durationMinutes}
                onChange={(e) => set('durationMinutes', e.target.value)}
              />
            </Field>
          </div>
          <p className="type-caption text-muted-foreground">
            Total learning time, not an access period (B-02 pending).
          </p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <Field
            id="course-price"
            label="Price"
            optional
            error={errors.priceMinor}
            hint="Leave empty if not decided; 0 means free. For administration only — prices are not shown publicly or charged until payments are enabled (PHASE 10)."
          >
            <Input
              inputMode="decimal"
              value={state.price}
              placeholder="e.g. 2500.00"
              onChange={(e) => set('price', e.target.value)}
            />
          </Field>
          <SelectField
            id="course-currency"
            label="Currency"
            error={errors.currency}
            value={state.currency}
            onValueChange={(value) => set('currency', value)}
            options={SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="course-discount-type"
            label="Discount"
            optional
            error={errors.discountType}
            value={state.discountType}
            onValueChange={(value) => set('discountType', value as FormState['discountType'])}
            options={[
              { value: NONE, label: 'No discount' },
              { value: 'PERCENTAGE', label: 'Percentage' },
              { value: 'FIXED_AMOUNT', label: 'Fixed amount' },
            ]}
          />
          <Field
            id="course-discount-value"
            label={state.discountType === 'PERCENTAGE' ? 'Discount (%)' : 'Discount amount'}
            error={errors.discountValue}
            hint="Discount rules are pending client confirmation (M-06); no final price is calculated."
          >
            <Input
              inputMode="decimal"
              value={state.discountValue}
              disabled={state.discountType === NONE}
              onChange={(e) => set('discountValue', e.target.value)}
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        {isNew ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/admin/courses')}
            disabled={pending}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="lg" loading={pending} loadingText="Saving…">
          {isNew ? 'Create course' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
