'use client';

import type { AdminCourseDetail, FacultyOptionDto } from '@asra/types';
import { UserRoundX } from 'lucide-react';
import * as React from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { describeError } from '@/lib/auth/form-errors';

import { ErrorPanel, LoadingPanel } from './admin-ui';
import { useFacultyOptions } from './course-options';
import { errorMessage, useAdminApi } from './use-admin';

interface Assignment {
  facultyProfileId: string;
  isPrimary: boolean;
}

/**
 * Faculty assignment (CourseInstructor). Options come from `/admin/faculty` — accounts holding
 * the FACULTY role only. Exactly one primary instructor when any are assigned (API-enforced).
 */
export function FacultyPanel({
  course,
  onChanged,
}: {
  course: AdminCourseDetail;
  onChanged: (course: AdminCourseDetail) => void;
}) {
  const api = useAdminApi();
  const faculty = useFacultyOptions();
  const initial = React.useMemo<Assignment[]>(
    () =>
      course.instructors.map(({ facultyProfileId, isPrimary }) => ({
        facultyProfileId,
        isPrimary,
      })),
    [course.instructors],
  );
  const [assigned, setAssigned] = React.useState<Assignment[]>(initial);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (faculty.error) {
    return (
      <ErrorPanel
        title="Could not load faculty"
        message={errorMessage(faculty.error)}
        onRetry={faculty.reload}
      />
    );
  }
  if (!faculty.data) return <LoadingPanel label="Loading faculty…" />;

  // Current instructors stay listed even if they no longer appear as options (e.g. role removed).
  const rows: FacultyOptionDto[] = [
    ...faculty.data,
    ...course.instructors
      .filter(
        (item) =>
          !faculty.data?.some((option) => option.facultyProfileId === item.facultyProfileId),
      )
      .map((item) => ({
        facultyProfileId: item.facultyProfileId,
        fullName: item.fullName,
        designation: item.designation,
        employeeCode: null,
        assignable: false,
      })),
  ];

  const isAssigned = (id: string) => assigned.some((item) => item.facultyProfileId === id);
  const dirty = JSON.stringify(assigned) !== JSON.stringify(initial);

  function toggle(id: string, checked: boolean) {
    setAssigned((current) => {
      if (!checked) {
        const rest = current.filter((item) => item.facultyProfileId !== id);
        // Keep exactly one primary.
        if (rest.length > 0 && !rest.some((item) => item.isPrimary))
          rest[0] = { ...rest[0]!, isPrimary: true };
        return rest;
      }
      return [...current, { facultyProfileId: id, isPrimary: current.length === 0 }];
    });
  }

  function makePrimary(id: string) {
    setAssigned((current) =>
      current.map((item) => ({ ...item, isPrimary: item.facultyProfileId === id })),
    );
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const updated = await api.put<AdminCourseDetail>(`/admin/courses/${course.id}/instructors`, {
        instructors: assigned,
      });
      toast.success('Faculty assignment saved', { description: updated.title });
      onChanged(updated);
    } catch (caught) {
      setError(describeError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className="grid gap-4 rounded-xl border bg-card p-5 shadow-card"
      aria-labelledby="faculty-title"
    >
      <div className="grid gap-1">
        <h2 id="faculty-title" className="type-h4 text-heading">
          Faculty
        </h2>
        <p className="type-body-sm text-muted-foreground">
          Assign the teachers for this course and choose the primary instructor. Publishing needs at
          least one active faculty member.
        </p>
      </div>

      {error ? (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        <Alert tone="info" title="No faculty accounts yet">
          <p>
            Faculty accounts are created by an operator with{' '}
            <code>npm run auth:create-user -- --role FACULTY</code> until the staff-management
            screens exist (CLIENT-CLARIFICATIONS S-05).
          </p>
        </Alert>
      ) : (
        <fieldset className="grid gap-2">
          <legend className="sr-only">Faculty members</legend>
          {rows.map((option) => {
            const checked = isAssigned(option.facultyProfileId);
            const primary =
              assigned.find((item) => item.facultyProfileId === option.facultyProfileId)
                ?.isPrimary ?? false;
            const disabled = !option.assignable && !checked;
            const id = `faculty-${option.facultyProfileId}`;
            return (
              <div
                key={option.facultyProfileId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
              >
                <label htmlFor={id} className="flex min-w-0 cursor-pointer items-center gap-3">
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) => toggle(option.facultyProfileId, event.target.checked)}
                    className="size-4 accent-primary"
                  />
                  <span className="grid min-w-0">
                    <span className="truncate font-medium text-heading">{option.fullName}</span>
                    <span className="truncate type-caption text-muted-foreground">
                      {[option.designation, option.employeeCode].filter(Boolean).join(' · ') ||
                        'Faculty'}
                    </span>
                  </span>
                </label>
                <span className="flex items-center gap-2">
                  {option.assignable ? null : (
                    <Badge variant="secondary">
                      <UserRoundX aria-hidden /> Inactive account
                    </Badge>
                  )}
                  {checked ? (
                    <label className="inline-flex cursor-pointer items-center gap-2 type-body-sm">
                      <input
                        type="radio"
                        name="primary-instructor"
                        checked={primary}
                        onChange={() => makePrimary(option.facultyProfileId)}
                        className="size-4 accent-primary"
                      />
                      Primary
                    </label>
                  ) : null}
                </span>
              </div>
            );
          })}
        </fieldset>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={() => setAssigned(initial)} disabled={!dirty || pending}>
          Reset
        </Button>
        <Button
          onClick={() => void save()}
          disabled={!dirty}
          loading={pending}
          loadingText="Saving…"
        >
          Save faculty
        </Button>
      </div>
    </section>
  );
}
