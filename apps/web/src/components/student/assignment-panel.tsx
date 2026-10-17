'use client';

import type { StudentAssignmentDto } from '@asra/types';
import { STUDENT_SUBMISSION_MAX_LENGTH, studentSubmissionSchema } from '@asra/validation';
import { CheckCircle2, ExternalLink, Send } from 'lucide-react';
import * as React from 'react';

import { ConfirmDialog } from '@/components/admin/admin-ui';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';
import { formatDateTime } from '@/lib/format';

import { ErrorPanel, LoadingPanel } from './student-ui';
import { errorMessage, useApiResource, useStudentApi } from './use-student';

/**
 * Online submission for an ASSIGNMENT lesson (PHASE 08, extended in PHASE 09). Whether the student
 * may submit — or replace their work — is decided by the API (`canSubmit`, server time, the
 * assignment's late/resubmission policy); this panel only reflects it. Marks and feedback appear
 * only once faculty release the result.
 */
export function AssignmentPanel({ lessonId }: { lessonId: string }) {
  const api = useStudentApi();
  const path = `/student/lessons/${lessonId}/assignment`;
  const assignment = useApiResource(path, () => api.get<StudentAssignmentDto>(path));

  if (assignment.error && !assignment.data) {
    return <ErrorPanel message={errorMessage(assignment.error)} onRetry={assignment.reload} />;
  }
  if (!assignment.data) return <LoadingPanel label="Loading assignment…" rows={2} />;
  const data = assignment.data;

  return (
    <section aria-labelledby="submission-heading" className="grid gap-3">
      <h2 id="submission-heading" className="type-h3 text-heading">
        Your submission
      </h2>
      {!data.acceptingSubmissions ? (
        <Alert tone="info">
          <p>
            Online submission is not open for this assignment. Follow the instructions from your
            faculty.
          </p>
        </Alert>
      ) : data.submission ? (
        <>
          <SubmittedWork data={data} />
          {data.canSubmit ? <ResubmitSection data={data} onSubmitted={assignment.replace} /> : null}
        </>
      ) : data.canSubmit ? (
        <SubmissionForm data={data} onSubmitted={assignment.replace} />
      ) : (
        <Alert tone="warning">
          <p>{data.cannotSubmitReason}</p>
        </Alert>
      )}
    </section>
  );
}

function SubmittedWork({ data }: { data: StudentAssignmentDto }) {
  const submission = data.submission!;
  return (
    <div className="grid gap-3">
      <p className="flex flex-wrap items-center gap-2 type-body-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-success" aria-hidden />
        Submitted {formatDateTime(submission.submittedAt)} IST
        {submission.version > 1 ? (
          <Badge variant="secondary">Version {submission.version}</Badge>
        ) : null}
        {submission.late ? <Badge variant="warning">After the due date</Badge> : null}
      </p>
      <div className="rounded-xl border bg-card p-5 type-body break-words whitespace-pre-wrap">
        {submission.body}
      </div>
      {submission.attachmentUrl ? (
        <a
          href={submission.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 type-body-sm text-primary underline-offset-2 hover:underline"
        >
          <ExternalLink className="size-4" aria-hidden /> Your attached link
        </a>
      ) : null}
      {submission.result ? (
        <Alert
          tone="success"
          title={`Result: ${submission.result.marksAwarded} / ${submission.result.maxMarks}`}
        >
          {submission.result.feedback ? (
            <p className="whitespace-pre-line">{submission.result.feedback}</p>
          ) : (
            <p>No written feedback.</p>
          )}
        </Alert>
      ) : (
        <p className="type-body-sm text-muted-foreground">
          Your faculty will review it. Marks and feedback appear here once they are released.
        </p>
      )}
    </div>
  );
}

/** Shown when the assignment allows replacing work that has not been graded yet. */
function ResubmitSection({
  data,
  onSubmitted,
}: {
  data: StudentAssignmentDto;
  onSubmitted: (data: StudentAssignmentDto) => void;
}) {
  const [open, setOpen] = React.useState(false);
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setOpen(true)}>
          Replace my submission
        </Button>
        <span className="type-caption text-muted-foreground">
          Allowed until your work is graded. Your earlier version is kept for your faculty.
        </span>
      </div>
    );
  }
  return (
    <SubmissionForm
      data={data}
      resubmission
      onSubmitted={(next) => {
        setOpen(false);
        onSubmitted(next);
      }}
    />
  );
}

function SubmissionForm({
  data,
  onSubmitted,
  resubmission = false,
}: {
  data: StudentAssignmentDto;
  onSubmitted: (data: StudentAssignmentDto) => void;
  resubmission?: boolean;
}) {
  const api = useStudentApi();
  const [body, setBody] = React.useState('');
  const [link, setLink] = React.useState('');
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [parsedInput, setParsedInput] = React.useState<{
    body: string;
    attachmentUrl?: string | null;
  }>();
  // The clock is read once when the form opens (renders stay pure); the API decides lateness.
  const [openedAt] = React.useState(() => Date.now());
  const overdue = data.dueAt !== null && new Date(data.dueAt).getTime() < openedAt;

  function review(event: React.FormEvent) {
    event.preventDefault();
    const parsed = validateForm(studentSubmissionSchema, { body, attachmentUrl: link });
    setFormError(null);
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    setParsedInput(parsed.data);
    setConfirming(true);
  }

  return (
    <>
      <form onSubmit={review} noValidate className="grid gap-4 rounded-xl border bg-card p-5">
        <p className="type-body-sm text-muted-foreground">
          Marked out of {data.maxMarks}
          {data.dueAt ? ` · due ${formatDateTime(data.dueAt)} IST` : ''}.{' '}
          {data.allowResubmission
            ? 'You can replace your work until it is graded.'
            : 'You can submit once, so check your answer first.'}
        </p>
        {overdue ? (
          <Alert tone="warning">
            <p>The due date has passed. You can still submit; it will be marked as late.</p>
          </Alert>
        ) : null}
        {formError ? (
          <Alert tone="error">
            <p>{formError}</p>
          </Alert>
        ) : null}
        <Field
          id="submission-body"
          label="Your answer"
          error={errors.body}
          hint={`Plain text, up to ${STUDENT_SUBMISSION_MAX_LENGTH.toLocaleString('en-IN')} characters.`}
        >
          <Textarea value={body} rows={8} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field
          id="submission-link"
          label="Link to your work (https://)"
          optional
          error={errors.attachmentUrl}
          hint={`For example a shared document. ${data.fileUploads.available ? '' : data.fileUploads.message}`}
        >
          <Input
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </Field>
        <div>
          <Button type="submit">
            <Send aria-hidden /> {resubmission ? 'Submit new version' : 'Submit assignment'}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={resubmission ? 'Replace your submission?' : 'Submit your assignment?'}
        description={
          data.allowResubmission
            ? 'You can replace it again until your faculty grade it.'
            : 'You cannot change your submission after sending it.'
        }
        confirmLabel="Submit"
        pendingLabel="Submitting…"
        onConfirm={async () => {
          try {
            const saved = await api.post<StudentAssignmentDto>(
              `/student/lessons/${data.lessonId}/submission`,
              parsedInput,
            );
            toast.success('Assignment submitted');
            onSubmitted(saved);
          } catch (error) {
            const described = describeError(error);
            setErrors(described.fieldErrors);
            setFormError(described.message);
            toast.error('Could not submit', { description: described.message });
            throw error;
          }
        }}
      />
    </>
  );
}
