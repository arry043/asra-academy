'use client';

import type { StudentProfileDto } from '@asra/types';
import { studentProfileUpdateSchema } from '@asra/validation';
import { Award, CreditCard, History, MailCheck } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { FormAlert, FormField } from '@/components/auth/form-controls';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';
import { formatDate } from '@/lib/format';

import { EnrollmentRecords } from './student-pages';
import { ErrorPanel, LoadingPanel } from './student-ui';
import { errorMessage, useApiResource, useStudentApi } from './use-student';

/**
 * `/student/profile`. Only name and phone are editable (validated by the same schema as the API,
 * which rejects every other field). Email, role, verification and enrolments are read-only.
 */
export function StudentProfile() {
  const api = useStudentApi();
  const profile = useApiResource('/student/profile', () =>
    api.get<StudentProfileDto>('/student/profile'),
  );

  return (
    <>
      <PageHeader
        title="Profile"
        breadcrumbs={[{ label: 'Dashboard', href: '/student/dashboard' }, { label: 'Profile' }]}
      />
      {profile.error && !profile.data ? (
        <ErrorPanel message={errorMessage(profile.error)} onRetry={profile.reload} />
      ) : !profile.data ? (
        <LoadingPanel label="Loading your profile…" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <PersonalInformation profile={profile.data} onSaved={profile.replace} />
          <AcademicInformation profile={profile.data} />
          <div className="lg:col-span-2">
            <EnrollmentRecords />
          </div>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle as="h2">Records</CardTitle>
              <CardDescription>Your learning activity, payments and certificates.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/student/history">
                  <History aria-hidden /> Learning history
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/student/payments">
                  <CreditCard aria-hidden /> Payment history
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/student/certificates">
                  <Award aria-hidden /> Certificates
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function PersonalInformation({
  profile,
  onSaved,
}: {
  profile: StudentProfileDto;
  onSaved: (profile: StudentProfileDto) => void;
}) {
  const api = useStudentApi();
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [alert, setAlert] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = validateForm(studentProfileUpdateSchema, {
      fullName: form.get('fullName'),
      phone: form.get('phone'),
    });
    setAlert(null);
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    setPending(true);
    try {
      const updated = await api.patch<StudentProfileDto>('/student/profile', parsed.data);
      onSaved(updated);
      toast.success('Profile saved');
    } catch (error) {
      const { message, fieldErrors } = describeError(error);
      setErrors(fieldErrors);
      setAlert(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Personal information</CardTitle>
        <CardDescription>Member since {formatDate(profile.memberSince)}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          {alert ? (
            <FormAlert tone="error">
              <p>{alert}</p>
            </FormAlert>
          ) : null}
          <FormField
            id="fullName"
            label="Full name"
            autoComplete="name"
            required
            defaultValue={profile.fullName}
            error={errors.fullName}
          />
          <div className="grid gap-2">
            <span className="type-label">Email</span>
            <span className="flex flex-wrap items-center gap-2 type-body break-all">
              {profile.email}
              {profile.emailVerified ? (
                <Badge variant="success">
                  <MailCheck aria-hidden /> Verified
                </Badge>
              ) : null}
            </span>
            <span className="type-caption text-muted-foreground">
              Contact the academy to change your email address.
            </span>
          </div>
          <FormField
            id="phone"
            label="Phone (optional)"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            defaultValue={profile.phone ?? ''}
            error={errors.phone}
            hint="Leave empty to remove it."
          />
          <div>
            <Button type="submit" loading={pending} loadingText="Saving…">
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AcademicInformation({ profile }: { profile: StudentProfileDto }) {
  const rows = [
    { label: 'Student number', value: profile.studentCode },
    { label: 'Level', value: profile.academicLevel?.name },
    { label: 'Class', value: profile.class?.name },
    { label: 'Stream', value: profile.stream?.name },
  ].filter((row) => row.value);
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Academic information</CardTitle>
        <CardDescription>Recorded by the academy.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="type-body-sm text-muted-foreground">
            The academy has not recorded your class or stream yet.
          </p>
        ) : (
          <dl className="grid gap-3">
            {rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[8rem_1fr] gap-2 type-body-sm">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
