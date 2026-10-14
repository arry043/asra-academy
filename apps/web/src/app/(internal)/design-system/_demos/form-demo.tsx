'use client';

import * as React from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, SearchInput } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';

type Errors = Partial<Record<'fullName' | 'course' | 'classLevel', string>>;

/**
 * Form controls demo: labels, hints, errors, disabled states, Select and the loading button.
 * Submitting only validates locally and shows a toast — it calls no API.
 */
export function FormDemo() {
  const [errors, setErrors] = React.useState<Errors>({});
  const [course, setCourse] = React.useState('');
  const [pending, setPending] = React.useState(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: Errors = {};
    if (!String(data.get('fullName') ?? '').trim()) next.fullName = 'Enter your full name.';
    if (!course) next.course = 'Choose a course.';
    const level = Number(data.get('classLevel'));
    if (data.get('classLevel') && (level < 6 || level > 12))
      next.classLevel = 'Class must be between 6 and 12.';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error('Please fix the highlighted fields', {
        description: 'Errors are listed under each field.',
      });
      return;
    }
    setPending(true);
    // Simulated latency so the loading state is visible. No request is made.
    window.setTimeout(() => {
      setPending(false);
      toast.success('Form is valid (demo)', {
        description: 'Nothing was sent — this is a showcase.',
      });
    }, 900);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {Object.keys(errors).length > 0 ? (
        <Alert tone="error" title="Some fields need attention">
          <p>Fix the fields marked below and submit again.</p>
        </Alert>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Full name" id="demo-full-name" error={errors.fullName}>
          <Input name="fullName" autoComplete="name" />
        </Field>
        <Field label="Email" id="demo-email" hint="We never share your email." optional>
          <Input name="email" type="email" autoComplete="email" placeholder="name@example.com" />
        </Field>
        <Field label="Password" id="demo-password" hint="At least 10 characters.">
          <PasswordInput name="password" autoComplete="new-password" />
        </Field>
        <Field label="Class" id="demo-class" error={errors.classLevel} hint="6 to 12" optional>
          <Input name="classLevel" type="number" inputMode="numeric" min={6} max={12} />
        </Field>
        {/* Select's root renders no element, so it wraps the Field; the trigger is the control. */}
        <Select value={course} onValueChange={setCourse} name="course">
          <Field label="Course interest" id="demo-course" error={errors.course}>
            <SelectTrigger>
              <SelectValue placeholder="Select a course" />
            </SelectTrigger>
          </Field>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>School</SelectLabel>
              <SelectItem value="6-10">Classes 6–10</SelectItem>
              <SelectItem value="11-12">Classes 11–12</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Special courses</SelectLabel>
              <SelectItem value="english">English Language</SelectItem>
              <SelectItem value="entrepreneurship">Entrepreneurship &amp; Business</SelectItem>
              <SelectItem value="quranic">Quranic Studies</SelectItem>
              <SelectItem value="arabic">Arabic</SelectItem>
              <SelectItem value="urdu">Urdu</SelectItem>
              <SelectItem value="unavailable" disabled>
                Unavailable option (disabled)
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Field label="Search courses" id="demo-search" optional>
          <SearchInput name="q" placeholder="Search…" />
        </Field>
        <Field
          label="Disabled input"
          id="demo-disabled"
          hint="Disabled controls are dimmed and skipped by Tab."
        >
          <Input defaultValue="Read only value" disabled />
        </Field>
        <Select disabled>
          <Field label="Disabled select" id="demo-disabled-select">
            <SelectTrigger>
              <SelectValue placeholder="Not available" />
            </SelectTrigger>
          </Field>
          <SelectContent>
            <SelectItem value="x">x</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending} loadingText="Checking…">
          Submit (demo)
        </Button>
        <Button
          type="reset"
          variant="ghost"
          onClick={() => {
            setErrors({});
            setCourse('');
          }}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
